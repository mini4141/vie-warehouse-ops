from fastapi import APIRouter

from app import schemas
from app.sim.layout import build_layout

router = APIRouter(prefix="/api")


@router.get("/layout", response_model=schemas.Layout)
async def get_layout():
    return build_layout()
