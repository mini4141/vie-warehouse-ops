"""Pydantic response models: the only response shapes, and the source of the generated OpenAPI contract."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

RobotKind = Literal["amr", "forklift"]
RobotStatus = Literal["idle", "moving", "picking", "charging", "fault", "offline"]
Priority = Literal["low", "normal", "high"]
OrderStatus = Literal["queued", "in_progress", "completed", "short", "cancelled"]
TaskType = Literal["move", "pick", "charge"]
TaskStatus = Literal["pending", "active", "done"]
Severity = Literal["info", "warn", "error"]


class Camel(BaseModel):
    """camelCase on the wire; every field is required so generated TS types have no optionals."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Point(Camel):
    x: float
    y: float


class Robot(Camel):
    id: str
    kind: RobotKind
    status: RobotStatus
    battery: float
    x: float
    y: float
    heading: float
    speed: float
    task_id: str | None
    last_seen: datetime


class Task(Camel):
    id: str
    order_id: str | None
    type: TaskType
    status: TaskStatus
    robot_id: str | None
    from_: Point = Field(alias="from")
    to: Point
    sku: str | None
    qty: int | None
    location_label: str | None
    started_at: datetime | None
    finished_at: datetime | None


class RobotDetail(Robot):
    task: Task | None


class Order(Camel):
    id: str
    customer: str
    priority: Priority
    status: OrderStatus
    line_count: int
    lines_done: int
    created_at: datetime
    due_at: datetime


class OrderDetail(Order):
    tasks: list[Task]


class OrderCounts(Camel):
    """Keys are the order status values verbatim (snake_case), so the TS side can index by status."""

    queued: int
    in_progress: int = Field(alias="in_progress")
    completed: int
    short: int
    cancelled: int


class OrdersResponse(Camel):
    items: list[Order]
    counts: OrderCounts


class Event(Camel):
    id: int
    ts: datetime
    severity: Severity
    code: str
    robot_id: str | None
    order_id: str | None
    params: dict[str, str | int | float]


class Rack(Camel):
    x: float
    y: float
    w: float
    d: float
    h: float


class Station(Camel):
    id: str
    x: float
    y: float
    kind: Literal["pick", "pack"]


class Charger(Camel):
    id: str
    x: float
    y: float


class Layout(Camel):
    width: float
    height: float
    racks: list[Rack]
    stations: list[Station]
    chargers: list[Charger]


class KpiPoint(Camel):
    ts: datetime
    lines_per_min: float
    utilization: float


class StatusCounts(Camel):
    idle: int
    moving: int
    picking: int
    charging: int
    fault: int
    offline: int


class DashboardSummary(Camel):
    online: int
    total: int
    utilization: float
    orders_in_progress: int
    lines_per_min: float
    series: list[KpiPoint]
    by_status: StatusCounts


class CommandBody(Camel):
    command: Literal["pause", "resume", "recall"]


class NextTask(Camel):
    task: Task | None


class Ok(Camel):
    ok: bool
