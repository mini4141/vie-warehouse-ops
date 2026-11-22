from fastapi import APIRouter, Request

from app import schemas, services

router = APIRouter(prefix="/api")


@router.get("/events", response_model=list[schemas.Event])
async def list_events(request: Request, limit: int = 200):
    return [services.event(e) for e in reversed(request.app.state.engine.events[-limit:])]
