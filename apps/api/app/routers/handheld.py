from fastapi import APIRouter, Request

from app import schemas, services

router = APIRouter(prefix="/api/handheld")


@router.get("/next-task", response_model=schemas.NextTask)
async def next_task(request: Request):
    t = request.app.state.engine.next_handheld_task()
    return schemas.NextTask(task=services.task(t) if t else None)


@router.post("/tasks/{task_id}/confirm", response_model=schemas.Ok)
async def confirm(task_id: str, request: Request):
    eng = request.app.state.engine
    eng.confirm_task(services.get_task(eng, task_id))
    return schemas.Ok(ok=True)


@router.post("/tasks/{task_id}/issue", response_model=schemas.Ok)
async def issue(task_id: str, request: Request):
    eng = request.app.state.engine
    t = services.get_task(eng, task_id)
    eng.emit("warn", "PICK_ISSUE", {"location": t.location_label or ""}, t.robot_id, t.order_id)
    return schemas.Ok(ok=True)
