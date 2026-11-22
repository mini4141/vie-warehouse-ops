from fastapi import APIRouter, Request

from app import schemas, services

router = APIRouter(prefix="/api")


@router.get("/orders", response_model=schemas.OrdersResponse)
async def list_orders(request: Request, status: schemas.OrderStatus | None = None):
    return services.list_orders(request.app.state.engine, status)


@router.post("/orders/demo", response_model=schemas.Order)
async def create_demo_order(request: Request):
    return services.order(request.app.state.engine.create_order())


@router.get("/orders/{order_id}", response_model=schemas.OrderDetail)
async def get_order(order_id: str, request: Request):
    return services.order_detail(request.app.state.engine, order_id)
