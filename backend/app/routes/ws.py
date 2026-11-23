from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.websocket_manager import ws_manager
import logging

logger = logging.getLogger("sern.routes.ws")

router = APIRouter(tags=["Real-Time WebSockets"])


@router.websocket("/ws")
async def websocket_emergency_feed(websocket: WebSocket):
    """
    Real-time push channel for zero-latency accident alerts, ambulance telemetry,
    and emergency lifecycle updates.
    """
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection open; receive ping or client queries
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type": "pong"}')
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.warning("WebSocket exception: %s", exc)
        ws_manager.disconnect(websocket)
