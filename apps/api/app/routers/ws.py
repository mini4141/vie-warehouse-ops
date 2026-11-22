import asyncio
import json

from fastapi import APIRouter, WebSocket

from app import services

router = APIRouter()


@router.websocket("/ws/telemetry")
async def telemetry(ws: WebSocket):
    """5 Hz robot frames, events on change, counts every 2 s (see SPECS section 8)."""
    await ws.accept()
    eng = ws.app.state.engine
    queue = eng.subscribe()
    try:
        n = 0
        while True:
            await ws.send_text(eng.frame_json())
            while not queue.empty():
                payload = services.event(queue.get_nowait()).model_dump(mode="json", by_alias=True)
                await ws.send_text(json.dumps({"type": "event", "event": payload}))
            if n % 10 == 0:
                await ws.send_text(eng.counts_json())
            n += 1
            await asyncio.sleep(0.2)
    except Exception:  # client went away; nothing to clean up beyond the queue
        pass
    finally:
        eng.unsubscribe(queue)
