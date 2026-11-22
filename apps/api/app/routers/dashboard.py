from fastapi import APIRouter, Request

from app import schemas, services

router = APIRouter(prefix="/api")


@router.get("/dashboard/summary", response_model=schemas.DashboardSummary)
async def dashboard_summary(request: Request):
    return services.summary(request.app.state.engine)
