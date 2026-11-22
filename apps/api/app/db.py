import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./woc.db")


class Base(DeclarativeBase):
    pass


_kwargs = {}
if DATABASE_URL.endswith(":memory:"):
    _kwargs = {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}}

engine = create_async_engine(DATABASE_URL, **_kwargs)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db() -> None:
    """create_all on startup; no Alembic for a demo that is destroyed the same day."""
    from app import models  # noqa: F401  (registers tables)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
