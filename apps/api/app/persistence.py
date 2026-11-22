"""Slow snapshot of the in-memory simulator to the DB, and restore on boot (best-effort by design)."""

import logging
from dataclasses import asdict, fields
from datetime import UTC

from sqlalchemy import delete, insert, select

from app import models as m
from app.db import SessionLocal
from app.sim.engine import Engine, EventState, KpiState, OrderState, RobotState, TaskState

log = logging.getLogger("woc.persistence")
_RUNTIME = {"route", "ri", "phase", "paused", "saved_status", "fault_until", "pick_until", "low_flag"}


def _persisted(obj, exclude: set[str]) -> dict:
    return {f.name: getattr(obj, f.name) for f in fields(obj) if f.name not in exclude}


def _utc(dt):
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=UTC)  # SQLite drops tzinfo


async def snapshot(eng: Engine) -> None:
    async with SessionLocal() as s, s.begin():
        for model in (m.Robot, m.Order, m.Task, m.Event, m.KpiPoint):
            await s.execute(delete(model))
        batches = [
            (m.Robot, [_persisted(r, _RUNTIME) for r in eng.robots]),
            (m.Order, [asdict(o) for o in eng.orders.values()]),
            (m.Task, [asdict(t) for t in eng.tasks.values()]),
            (m.Event, [asdict(e) for e in eng.events]),
            (m.KpiPoint, [asdict(k) for k in eng.series]),
        ]
        for model, rows in batches:
            if rows:
                await s.execute(insert(model), rows)


async def restore(eng: Engine) -> bool:
    """Loads the last snapshot into `eng`. Returns False when the tables are empty (first boot)."""
    async with SessionLocal() as s:
        robots = (await s.scalars(select(m.Robot).order_by(m.Robot.id))).all()
        if not robots:
            return False
        for row in robots:
            r = RobotState(
                id=row.id,
                kind=row.kind,
                status=row.status,
                battery=row.battery,
                x=row.x,
                y=row.y,
                heading=row.heading,
                last_seen=_utc(row.last_seen),
            )
            if r.status != "offline":
                r.status = "idle"  # routes are not persisted: in-flight work restarts from idle
            eng.robots.append(r)
            eng.robot_by_id[r.id] = r
        for row in (await s.scalars(select(m.Order).order_by(m.Order.id))).all():
            eng.orders[row.id] = OrderState(
                row.id,
                row.customer,
                row.priority,
                row.status,
                row.line_count,
                row.lines_done,
                _utc(row.created_at),
                _utc(row.due_at),
            )
        for row in (await s.scalars(select(m.Task).order_by(m.Task.id))).all():
            t = TaskState(
                row.id,
                row.order_id,
                row.type,
                row.status,
                row.robot_id,
                row.from_x,
                row.from_y,
                row.to_x,
                row.to_y,
                row.sku,
                row.qty,
                row.location_label,
                _utc(row.started_at),
                _utc(row.finished_at),
                row.handheld,
                row.confirmed,
            )
            if t.status == "active":
                t.status, t.robot_id, t.started_at = "pending", None, None
            eng.tasks[t.id] = t
            if t.status == "pending":
                eng.pending.append(t)
        for row in (await s.scalars(select(m.Event).order_by(m.Event.id))).all():
            eng.events.append(
                EventState(
                    row.id, _utc(row.ts), row.severity, row.code, row.robot_id, row.order_id, row.params
                )
            )
        for row in (await s.scalars(select(m.KpiPoint).order_by(m.KpiPoint.ts))).all():
            eng.series.append(KpiState(_utc(row.ts), row.lines_per_min, row.utilization))
    eng.order_seq = max((int(i[2:]) for i in eng.orders), default=0)
    eng.task_seq = max((int(i[2:]) for i in eng.tasks), default=0)
    eng.event_seq = max((e.id for e in eng.events), default=0)
    log.info("restored %d robots, %d orders", len(eng.robots), len(eng.orders))
    return True
