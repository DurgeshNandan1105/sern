import json
import logging
from typing import List, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger("sern.websocket")


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts real-time emergency events."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket client connected. Active connections: %d", len(self.active_connections))
        # Send initial confirmation
        await websocket.send_text(json.dumps({
            "type": "CONNECTION_ESTABLISHED",
            "message": "Connected to SERN Real-Time Operations Stream",
            "active_clients": len(self.active_connections)
        }))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info("WebSocket client disconnected. Remaining connections: %d", len(self.active_connections))

    async def broadcast(self, event_type: str, payload: Dict[str, Any]):
        """Broadcast an event payload to all connected frontend clients."""
        if not self.active_connections:
            return

        message_str = json.dumps({
            "type": event_type,
            "data": payload
        }, default=str)

        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except Exception as exc:
                logger.warning("Failed to deliver WebSocket message to client: %s", exc)
                disconnected.append(connection)

        for dead_conn in disconnected:
            self.disconnect(dead_conn)

    def broadcast_sync(self, event_type: str, payload: Dict[str, Any]):
        """Synchronous wrapper for thread-safe event broadcast from non-async routes."""
        if not self.active_connections:
            return

        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.broadcast(event_type, payload))
        except RuntimeError:
            try:
                # Run with isolated event loop when called outside an async context
                asyncio.run(self.broadcast(event_type, payload))
            except Exception as exc:
                logger.debug("broadcast_sync skipped: %s", exc)


ws_manager = ConnectionManager()
