from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

_TS = DateTime(timezone=True)


class Robot(Base):
    __tablename__ = "robots"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    kind: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    battery: Mapped[float] = mapped_column(Float)
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    heading: Mapped[float] = mapped_column(Float)
    speed: Mapped[float] = mapped_column(Float)
    task_id: Mapped[str | None] = mapped_column(String, nullable=True)
    last_seen: Mapped[datetime] = mapped_column(_TS)


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer: Mapped[str] = mapped_column(String)
    priority: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    line_count: Mapped[int] = mapped_column(Integer)
    lines_done: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(_TS)
    due_at: Mapped[datetime] = mapped_column(_TS)


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    order_id: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    robot_id: Mapped[str | None] = mapped_column(String, nullable=True)
    from_x: Mapped[float] = mapped_column(Float)
    from_y: Mapped[float] = mapped_column(Float)
    to_x: Mapped[float] = mapped_column(Float)
    to_y: Mapped[float] = mapped_column(Float)
    sku: Mapped[str | None] = mapped_column(String, nullable=True)
    qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    location_label: Mapped[str | None] = mapped_column(String, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(_TS, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(_TS, nullable=True)
    handheld: Mapped[bool] = mapped_column(Boolean)
    confirmed: Mapped[bool] = mapped_column(Boolean)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    ts: Mapped[datetime] = mapped_column(_TS)
    severity: Mapped[str] = mapped_column(String)
    code: Mapped[str] = mapped_column(String)
    robot_id: Mapped[str | None] = mapped_column(String, nullable=True)
    order_id: Mapped[str | None] = mapped_column(String, nullable=True)
    params: Mapped[dict] = mapped_column(JSON)


class KpiPoint(Base):
    __tablename__ = "kpi_points"
    ts: Mapped[datetime] = mapped_column(_TS, primary_key=True)
    lines_per_min: Mapped[float] = mapped_column(Float)
    utilization: Mapped[float] = mapped_column(Float)
