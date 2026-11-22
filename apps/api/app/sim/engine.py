"""In-memory warehouse simulator: orders -> tasks -> robots. One asyncio task drives `tick()` every 200 ms."""

import asyncio
import json
import math
import os
import random
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from .layout import AISLE_YS, CHARGERS, STATIONS, location_label
from .path import route

TICK = 0.2
SPEED = {"amr": 1.5, "forklift": 1.2}
STATUS_CODE = {"idle": 0, "moving": 1, "picking": 2, "charging": 3, "fault": 4, "offline": 5}
CUSTOMERS = [
    "Acme Retail",
    "Globex",
    "Initech",
    "Umbrella Foods",
    "Stark Logistics",
    "Wayne Supply",
    "Hooli",
    "Soylent",
]
PRIORITIES = ["low", "normal", "normal", "high"]
FAULT_REASONS = ["motor", "sensor", "blocked"]
FAULT_P = 0.005 / 60 * TICK  # 0.5 % per robot-minute
FAULT_SECONDS = 20
EVENT_CAP = 500
ORDER_CAP = 300


def now() -> datetime:
    return datetime.now(UTC)


@dataclass
class RobotState:
    id: str
    kind: str
    status: str = "idle"
    battery: float = 100.0
    x: float = 0.0
    y: float = 0.0
    heading: float = 0.0
    speed: float = 0.0
    task_id: str | None = None
    last_seen: datetime = field(default_factory=now)
    # runtime only (not persisted)
    route: list[tuple[float, float]] = field(default_factory=list)
    ri: int = 0
    phase: str | None = None
    paused: bool = False
    saved_status: str = "idle"
    fault_until: float = 0.0
    pick_until: float = 0.0
    low_flag: bool = False


@dataclass
class TaskState:
    id: str
    order_id: str | None
    type: str
    status: str
    robot_id: str | None
    from_x: float
    from_y: float
    to_x: float
    to_y: float
    sku: str | None
    qty: int | None
    location_label: str | None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    handheld: bool = False
    confirmed: bool = False


@dataclass
class OrderState:
    id: str
    customer: str
    priority: str
    status: str
    line_count: int
    lines_done: int
    created_at: datetime
    due_at: datetime


@dataclass
class EventState:
    id: int
    ts: datetime
    severity: str
    code: str
    robot_id: str | None
    order_id: str | None
    params: dict


@dataclass
class KpiState:
    ts: datetime
    lines_per_min: float
    utilization: float


class Engine:
    def __init__(self, seed: int = 42, order_interval: float | None = None):
        self.rnd = random.Random(seed)
        self.order_interval = order_interval or float(os.environ.get("SIM_ORDER_INTERVAL", "3"))
        self.robots: list[RobotState] = []
        self.robot_by_id: dict[str, RobotState] = {}
        self.orders: dict[str, OrderState] = {}
        self.tasks: dict[str, TaskState] = {}
        self.pending: list[TaskState] = []
        self.events: list[EventState] = []
        self.series: deque[KpiState] = deque(maxlen=60)
        self.line_stamps: deque[float] = deque()
        self.subscribers: set[asyncio.Queue] = set()
        self.sim_time = 0.0
        self.wall = now()
        self.next_order_at = 2.0
        self.next_kpi_at = 5.0
        self.next_prune_at = 60.0
        self.event_seq = 0
        self.task_seq = 0
        self.order_seq = 0

    # ---- identifiers / events -------------------------------------------------
    def new_order_id(self) -> str:
        self.order_seq += 1
        return f"O-{self.order_seq:05d}"

    def new_task_id(self) -> str:
        self.task_seq += 1
        return f"T-{self.task_seq:05d}"

    def emit(
        self,
        severity: str,
        code: str,
        params: dict | None = None,
        robot_id: str | None = None,
        order_id: str | None = None,
        ts: datetime | None = None,
    ) -> EventState:
        self.event_seq += 1
        ev = EventState(self.event_seq, ts or now(), severity, code, robot_id, order_id, params or {})
        self.events.append(ev)
        if len(self.events) > EVENT_CAP:
            del self.events[0]
        for q in self.subscribers:
            if not q.full():
                q.put_nowait(ev)
        return ev

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self.subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self.subscribers.discard(q)

    # ---- orders and tasks -----------------------------------------------------
    def create_order(self, lines: int | None = None) -> OrderState:
        rnd = self.rnd
        n = lines or rnd.randint(1, 5)
        created = self.wall
        order = OrderState(
            id=self.new_order_id(),
            customer=rnd.choice(CUSTOMERS),
            priority=rnd.choice(PRIORITIES),
            status="queued",
            line_count=n,
            lines_done=0,
            created_at=created,
            due_at=created + timedelta(minutes=rnd.uniform(10, 30)),
        )
        self.orders[order.id] = order
        for _ in range(n):
            aisle = rnd.randrange(len(AISLE_YS))
            x = rnd.uniform(5, 55)
            station = rnd.choice(STATIONS)
            task = TaskState(
                id=self.new_task_id(),
                order_id=order.id,
                type="pick",
                status="pending",
                robot_id=None,
                from_x=x,
                from_y=AISLE_YS[aisle],
                to_x=station["x"],
                to_y=station["y"],
                sku=f"SKU-{rnd.randint(1000, 9999)}",
                qty=rnd.randint(1, 8),
                location_label=location_label(aisle, x),
                handheld=rnd.random() < 0.15,
            )
            self.tasks[task.id] = task
            self.pending.append(task)
        self.emit("info", "ORDER_CREATED", {"lines": n}, order_id=order.id)
        return order

    def assign(self) -> None:
        if not self.pending:
            return
        idle = [
            r
            for r in self.robots
            if r.status == "idle" and not r.paused and not r.task_id and r.battery >= 25
        ]
        while self.pending and idle:
            task = self.pending.pop(0)
            robot = min(idle, key=lambda r: abs(r.x - task.from_x) + abs(r.y - task.from_y))
            idle.remove(robot)
            task.status, task.robot_id, task.started_at = "active", robot.id, self.wall
            robot.task_id = task.id
            self.set_route(robot, (task.from_x, task.from_y), "toPick")
            order = self.orders.get(task.order_id or "")
            if order and order.status == "queued":
                order.status = "in_progress"

    # ---- robot behaviour ------------------------------------------------------
    @staticmethod
    def nearest_charger(r: RobotState) -> tuple[float, float]:
        c = min(CHARGERS, key=lambda c: math.hypot(c["x"] - r.x, c["y"] - r.y))
        return c["x"], c["y"]

    def set_route(self, r: RobotState, dest: tuple[float, float], phase: str) -> None:
        r.route, r.ri, r.phase = route((r.x, r.y), dest), 0, phase
        r.status = "moving"

    def advance(self, r: RobotState) -> bool:
        dist = SPEED[r.kind] * TICK
        while dist > 0 and r.ri < len(r.route):
            px, py = r.route[r.ri]
            dx, dy = px - r.x, py - r.y
            d = math.hypot(dx, dy)
            if d > 1e-6:
                r.heading = math.atan2(dy, dx)
            if d <= dist:
                r.x, r.y, dist, r.ri = px, py, dist - d, r.ri + 1
            else:
                r.x, r.y, dist = r.x + dx / d * dist, r.y + dy / d * dist, 0
        return r.ri >= len(r.route)

    def arrive(self, r: RobotState) -> None:
        task = self.tasks.get(r.task_id or "")
        if r.phase == "toPick":
            r.status, r.pick_until, r.speed = "picking", self.sim_time + 2, 0.0
        elif r.phase == "toStation" and task:
            task.status, task.finished_at = "done", self.wall
            r.task_id, r.status, r.phase, r.speed = None, "idle", None, 0.0
            self.line_stamps.append(time.monotonic())
            order = self.orders.get(task.order_id or "")
            if order:
                order.lines_done += 1
                if order.lines_done >= order.line_count:
                    order.status = "completed"
                    self.emit("info", "ORDER_DONE", {}, r.id, order.id)
        elif r.phase == "toCharger":
            r.status, r.phase, r.speed = "charging", "charging", 0.0

    def fault(self, r: RobotState, reason: str) -> EventState:
        r.saved_status, r.status, r.speed = r.status, "fault", 0.0
        r.fault_until = self.sim_time + FAULT_SECONDS
        return self.emit("error", "ROBOT_FAULT", {"reason": reason}, r.id)

    def step(self, r: RobotState) -> None:
        if r.status == "offline":
            return
        r.last_seen = self.wall
        if r.battery < 20 and not r.low_flag:
            r.low_flag = True
            self.emit("warn", "LOW_BATTERY", {"battery": round(r.battery)}, r.id)
        if r.status == "fault":
            if self.sim_time >= r.fault_until:
                r.status = r.saved_status
                self.emit("info", "ROBOT_RECOVERED", {}, r.id)
            return
        if r.paused:
            return
        if r.status == "moving":
            r.speed = SPEED[r.kind]
            r.battery = max(0.0, r.battery - 0.15 * TICK)
            if self.rnd.random() < FAULT_P:
                self.fault(r, self.rnd.choice(FAULT_REASONS))
            elif self.advance(r):
                self.arrive(r)
        elif r.status == "picking":
            task = self.tasks.get(r.task_id or "")
            if task and self.sim_time >= r.pick_until and (not task.handheld or task.confirmed):
                self.set_route(r, (task.to_x, task.to_y), "toStation")
        elif r.status == "charging":
            r.battery = min(100.0, r.battery + 2 * TICK)
            if r.battery >= 90:
                r.status, r.phase, r.low_flag = "idle", None, False
        elif r.status == "idle" and r.battery < 20 and not r.task_id:
            self.set_route(r, self.nearest_charger(r), "toCharger")

    # ---- commands (REST) ------------------------------------------------------
    def command(self, r: RobotState, cmd: str) -> None:
        if r.status in ("offline", "fault"):
            return
        if cmd == "pause" and not r.paused:
            r.paused, r.saved_status, r.status, r.speed = True, r.status, "idle", 0.0
        elif cmd == "resume" and r.paused:
            r.paused, r.status = False, r.saved_status
        elif cmd == "recall":
            if r.paused:
                r.paused = False
            task = self.tasks.get(r.task_id or "")
            if task and task.status == "active":
                task.status, task.robot_id, task.started_at = "pending", None, None
                self.pending.insert(0, task)
            r.task_id = None
            self.set_route(r, self.nearest_charger(r), "toCharger")
        self.emit("info", "ROBOT_COMMAND", {"command": cmd}, r.id)

    def inject_fault(self) -> EventState:
        pool = [r for r in self.robots if r.status == "moving"] or [
            r for r in self.robots if r.status not in ("offline", "fault", "charging")
        ]
        return self.fault(self.rnd.choice(pool), "motor")

    def confirm_task(self, task: TaskState) -> None:
        task.confirmed = True

    # ---- tick -----------------------------------------------------------------
    def tick(self) -> None:
        self.sim_time += TICK
        self.wall = now()
        if self.sim_time >= self.next_order_at:
            self.create_order()
            self.next_order_at = self.sim_time + self.order_interval
        self.assign()
        for r in self.robots:
            self.step(r)
        if self.sim_time >= self.next_kpi_at:
            self.next_kpi_at += 5
            self.series.append(KpiState(self.wall, float(self.lines_per_min()), self.utilization()))
        if self.sim_time >= self.next_prune_at:
            self.next_prune_at += 60
            self.prune()

    def prune(self) -> None:
        """Keeps memory (and the DB snapshot) bounded on a long-running demo."""
        finished = [o.id for o in self.orders.values() if o.status in ("completed", "short", "cancelled")]
        for oid in finished[: max(0, len(self.orders) - ORDER_CAP)]:
            del self.orders[oid]
        live = set(self.orders)
        for tid in [t.id for t in self.tasks.values() if t.order_id not in live]:
            del self.tasks[tid]

    # ---- read models ----------------------------------------------------------
    def by_status(self) -> dict[str, int]:
        counts = dict.fromkeys(STATUS_CODE, 0)
        for r in self.robots:
            counts[r.status] += 1
        return counts

    def lines_per_min(self) -> int:
        cutoff = time.monotonic() - 60
        while self.line_stamps and self.line_stamps[0] < cutoff:
            self.line_stamps.popleft()
        return len(self.line_stamps)

    def utilization(self) -> float:
        c = self.by_status()
        online = len(self.robots) - c["offline"]
        return (c["moving"] + c["picking"]) / online if online else 0.0

    def next_handheld_task(self) -> TaskState | None:
        open_tasks = [t for t in self.tasks.values() if t.handheld and t.status != "done" and not t.confirmed]
        active = [t for t in open_tasks if t.status == "active"]
        return (active or open_tasks or [None])[0]

    def frame_json(self) -> str:
        rows = [
            [i, round(r.x, 2), round(r.y, 2), round(r.heading, 2), round(r.battery, 1), STATUS_CODE[r.status]]
            for i, r in enumerate(self.robots)
        ]
        return json.dumps({"type": "robots", "t": int(time.time() * 1000), "r": rows}, separators=(",", ":"))

    def counts_json(self) -> str:
        c = self.by_status()
        online = len(self.robots) - c["offline"]
        return json.dumps({"type": "counts", "online": online, "total": len(self.robots), "byStatus": c})


async def run(engine: Engine) -> None:
    loop = asyncio.get_running_loop()
    due = loop.time()
    while True:
        engine.tick()
        due += TICK
        lag = due - loop.time()
        if lag < -1:  # fell far behind (debugger, suspend): do not burst to catch up
            due = loop.time()
        await asyncio.sleep(max(0.0, lag))
