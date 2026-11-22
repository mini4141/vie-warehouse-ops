from fastapi import APIRouter, Request

from app import schemas, services

router = APIRouter(prefix="/api/sim")


@router.post("/faults", response_model=schemas.Event)
async def inject_fault(request: Request):
    return services.event(request.app.state.engine.inject_fault())
