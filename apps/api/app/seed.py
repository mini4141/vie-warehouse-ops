"""Deterministic seed from SIM_SEED: 200 robots, 60 historic orders, 40 historic events."""

import math
from datetime import timedelta

from app.sim.engine import CUSTOMERS, PRIORITIES, Engine, KpiState, OrderState, RobotState, TaskState, now
from app.sim.layout import AISLE_YS, STATIONS, location_label


def build_engine(seed: int, robots: int) -> Engine:
    eng = Engine(seed)
    rnd = eng.rnd
    for i in range(robots):
        r = RobotState(
            id=f"R-{i + 1:03d}",
            kind="forklift" if i % 10 == 0 else "amr",
            battery=rnd.uniform(40, 100),
            x=rnd.uniform(2, 58),
            y=rnd.choice(AISLE_YS),
            heading=rnd.choice([0, math.pi / 2, math.pi, -math.pi / 2]),
        )
        eng.robots.append(r)
        eng.robot_by_id[r.id] = r
    for r in rnd.sample(eng.robots, 4):
        r.status = "offline"

    t0 = now()
    for i in range(60):
        n = rnd.randint(1, 5)
        created = t0 - timedelta(seconds=(60 - i) * 90)
        order = OrderState(
            id=eng.new_order_id(),
            customer=rnd.choice(CUSTOMERS),
            priority=rnd.choice(PRIORITIES),
            status="completed" if rnd.random() < 0.9 else "short",
            line_count=n,
            lines_done=n,
            created_at=created,
            due_at=created + timedelta(minutes=20),
        )
        eng.orders[order.id] = order
        for _ in range(n):
            aisle, x, st = rnd.randrange(len(AISLE_YS)), rnd.uniform(5, 55), rnd.choice(STATIONS)
            task = TaskState(
                id=eng.new_task_id(),
                order_id=order.id,
                type="pick",
                status="done",
                robot_id=rnd.choice(eng.robots).id,
                from_x=x,
                from_y=AISLE_YS[aisle],
                to_x=st["x"],
                to_y=st["y"],
                sku=f"SKU-{rnd.randint(1000, 9999)}",
                qty=rnd.randint(1, 8),
                location_label=location_label(aisle, x),
                started_at=created + timedelta(seconds=30),
                finished_at=created + timedelta(seconds=120),
                confirmed=True,
            )
            eng.tasks[task.id] = task
    for i in range(40):
        sev, code = rnd.choice([("info", "ORDER_DONE"), ("warn", "LOW_BATTERY"), ("info", "ORDER_CREATED")])
        params = {"battery": rnd.randint(10, 19)} if code == "LOW_BATTERY" else {}
        eng.emit(sev, code, params, ts=t0 - timedelta(seconds=(40 - i) * 45))
    for i in range(60):
        eng.series.append(
            KpiState(t0 - timedelta(seconds=(60 - i) * 5), 8 + rnd.random() * 6, 0.3 + rnd.random() * 0.15)
        )
    return eng
