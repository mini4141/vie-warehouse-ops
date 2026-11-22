import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import persistence
from app.db import init_db
from app.routers import dashboard, events, handheld, layout, orders, robots, sim, ws
from app.seed import build_engine
from app.sim import engine as sim_engine

log = logging.getLogger("woc")
SNAPSHOT_SECONDS = 10


async def _snapshot_loop(eng: sim_engine.Engine) -> None:
    while True:
        await asyncio.sleep(SNAPSHOT_SECONDS)
        try:
            await persistence.snapshot(eng)
        except Exception:
            log.exception("snapshot failed")  # persistence is best-effort by design


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    seed = int(os.environ.get("SIM_SEED", "42"))
    eng = sim_engine.Engine(seed)
    if not await persistence.restore(eng):  # first boot: seed, then persist straight away
        eng = build_engine(seed, int(os.environ.get("SIM_ROBOTS", "200")))
        await persistence.snapshot(eng)
    app.state.engine = eng
    tasks = [asyncio.create_task(sim_engine.run(eng)), asyncio.create_task(_snapshot_loop(eng))]
    try:
        yield
    finally:
        for t in tasks:
            t.cancel()
        try:
            await persistence.snapshot(eng)
        except Exception:
            log.exception("final snapshot failed")


app = FastAPI(title="Warehouse Ops Console API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (layout, robots, dashboard, orders, events, handheld, sim):
    app.include_router(module.router)
app.include_router(ws.router)


@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"ok": True}
