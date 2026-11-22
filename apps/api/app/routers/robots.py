from fastapi import APIRouter, Request

from app import schemas, services

router = APIRouter(prefix="/api")


@router.get("/robots", response_model=list[schemas.Robot])
async def list_robots(request: Request):
    # Order is stable by id: the index is the telemetry `idx`.
    return [services.robot(r) for r in request.app.state.engine.robots]


@router.get("/robots/{robot_id}", response_model=schemas.RobotDetail)
async def get_robot(robot_id: str, request: Request):
    return services.robot_detail(request.app.state.engine, robot_id)


@router.post("/robots/{robot_id}/commands", response_model=schemas.Robot)
async def post_command(robot_id: str, body: schemas.CommandBody, request: Request):
    return services.command(request.app.state.engine, robot_id, body.command)
