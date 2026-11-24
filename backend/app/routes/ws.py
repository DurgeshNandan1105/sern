from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.websocket_manager import ws_manager
import logging

logger = logging.getLogger("sern.routes.ws")

router = APIRouter(tags=["Real-Time WebSockets"])


@router.get("/ws")
def websocket_http_probe():
    """
    HTTP probe for the WebSocket channel. Prevents HTTP 400 Bad Request
    when proxies or health monitors ping the /ws endpoint using HTTP GET.
    """
    return {
        "status": "online",
        "channel": "Real-Time Emergency Stream",
        "protocol": "websocket",
        "active_connections": len(ws_manager.active_connections),
        "connect_url": "/api/ws"
    }


@router.websocket("/ws")
@router.websocket("/ws/")
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
