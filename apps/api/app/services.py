"""Plain functions turning simulator state into response models. No repository layer, no DI container."""

from fastapi import HTTPException

from app import schemas as s
from app.sim.engine import Engine, EventState, OrderState, RobotState, TaskState


def robot(r: RobotState) -> s.Robot:
    return s.Robot(
        id=r.id,
        kind=r.kind,
        status=r.status,
        battery=round(r.battery, 1),
        x=round(r.x, 2),
        y=round(r.y, 2),
        heading=round(r.heading, 2),
        speed=r.speed,
        task_id=r.task_id,
        last_seen=r.last_seen,
    )


def task(t: TaskState) -> s.Task:
    return s.Task(
        id=t.id,
        order_id=t.order_id,
        type=t.type,
        status=t.status,
        robot_id=t.robot_id,
        **{"from": s.Point(x=t.from_x, y=t.from_y)},
        to=s.Point(x=t.to_x, y=t.to_y),
        sku=t.sku,
        qty=t.qty,
        location_label=t.location_label,
        started_at=t.started_at,
        finished_at=t.finished_at,
    )


def order(o: OrderState) -> s.Order:
    return s.Order(
        id=o.id,
        customer=o.customer,
        priority=o.priority,
        status=o.status,
        line_count=o.line_count,
        lines_done=o.lines_done,
        created_at=o.created_at,
        due_at=o.due_at,
    )


def event(e: EventState) -> s.Event:
    return s.Event(
        id=e.id,
        ts=e.ts,
        severity=e.severity,
        code=e.code,
        robot_id=e.robot_id,
        order_id=e.order_id,
        params=e.params,
    )


def get_robot(eng: Engine, robot_id: str) -> RobotState:
    r = eng.robot_by_id.get(robot_id)
    if not r:
        raise HTTPException(404, "robot not found")
    return r


def robot_detail(eng: Engine, robot_id: str) -> s.RobotDetail:
    r = get_robot(eng, robot_id)
    t = eng.tasks.get(r.task_id or "")
    return s.RobotDetail(**robot(r).model_dump(), task=task(t) if t else None)


def command(eng: Engine, robot_id: str, cmd: str) -> s.Robot:
    r = get_robot(eng, robot_id)
    eng.command(r, cmd)
    return robot(r)


def summary(eng: Engine) -> s.DashboardSummary:
    c = eng.by_status()
    return s.DashboardSummary(
        online=len(eng.robots) - c["offline"],
        total=len(eng.robots),
        utilization=eng.utilization(),
        orders_in_progress=sum(o.status == "in_progress" for o in eng.orders.values()),
        lines_per_min=eng.lines_per_min(),
        series=[
            s.KpiPoint(ts=k.ts, lines_per_min=k.lines_per_min, utilization=k.utilization) for k in eng.series
        ],
        by_status=s.StatusCounts(**c),
    )


def list_orders(eng: Engine, status: str | None) -> s.OrdersResponse:
    counts = dict.fromkeys(("queued", "in_progress", "completed", "short", "cancelled"), 0)
    for o in eng.orders.values():
        counts[o.status] += 1
    items = [o for o in reversed(eng.orders.values()) if not status or o.status == status][:200]
    return s.OrdersResponse(items=[order(o) for o in items], counts=s.OrderCounts(**counts))


def order_detail(eng: Engine, order_id: str) -> s.OrderDetail:
    o = eng.orders.get(order_id)
    if not o:
        raise HTTPException(404, "order not found")
    tasks = [task(t) for t in eng.tasks.values() if t.order_id == order_id]
    return s.OrderDetail(**order(o).model_dump(), tasks=tasks)


def get_task(eng: Engine, task_id: str) -> TaskState:
    t = eng.tasks.get(task_id)
    if not t:
        raise HTTPException(404, "task not found")
    return t
