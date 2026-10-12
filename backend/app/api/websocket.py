"""Cookie-authenticated WebSocket endpoint for session notifications.

The connection manager is intentionally process-local. It provides best-effort
notifications only; REST endpoints and session validation remain authoritative
when the app runs on multiple Container App replicas.
"""
import json
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import now
from app.services.security import identity_from_websocket

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ws", tags=["websocket"])


class ConnectionManager:
    """Track WebSockets owned by this worker process (not a distributed bus)."""

    def __init__(self):
        self.active_connections: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections.setdefault(user_id, set()).add(websocket)
        logger.info("WebSocket connected")
        await self.send_personal_message(
            user_id, {"type": "session_status", "data": {"status": "connected", "timestamp": now()}}
        )

    def disconnect(self, websocket: WebSocket, user_id: str):
        connections = self.active_connections.get(user_id)
        if connections is not None:
            connections.discard(websocket)
            if not connections:
                self.active_connections.pop(user_id, None)
        logger.info("WebSocket disconnected")

    async def send_personal_message(self, user_id: str, message: dict):
        connections = self.active_connections.get(user_id)
        if not connections:
            return
        message_text = json.dumps(message)
        for websocket in connections.copy():
            try:
                await websocket.send_text(message_text)
            except Exception:
                logger.warning("Failed to send WebSocket notification")
                connections.discard(websocket)
        if not connections:
            self.active_connections.pop(user_id, None)

    async def broadcast_to_user(self, user_id: str, event_type: str, data: dict):
        await self.send_personal_message(user_id, {"type": event_type, "data": data})

    async def notify_session_expired(self, user_id: str):
        await self.broadcast_to_user(
            user_id,
            "session_expired",
            {"message": "Your session has expired. Please log in again.", "timestamp": now()},
        )

    async def notify_logout(self, user_id: str, reason: str = "logout"):
        await self.broadcast_to_user(user_id, "logout", {"reason": reason, "timestamp": now()})


manager = ConnectionManager()


def _origin_allowed(websocket: WebSocket) -> bool:
    """Allow configured browser origins; permit missing Origin for non-browser clients.

    Browsers send Origin on WebSocket handshakes. An absent Origin is not proof
    of a browser request, so cookie authentication remains mandatory below.
    """
    origin = websocket.headers.get("origin")
    if not origin:
        return True
    allowed = {
        item.strip().rstrip("/")
        for item in get_settings().allowed_origins.split(",")
        if item.strip()
    }
    return origin.rstrip("/") in allowed


@router.websocket("/session")
async def websocket_session(websocket: WebSocket, db: Session = Depends(get_db)):
    """Session management socket. Existing message names and payloads are stable."""
    if not _origin_allowed(websocket):
        await websocket.close(code=4403, reason="Origin not allowed")
        return

    user_id: str | None = None
    try:
        current = await identity_from_websocket(websocket, db)
        if not current:
            await websocket.close(code=4001, reason="Unauthorized")
            return

        user_id = current.user.id
        await manager.connect(websocket, user_id)
        try:
            while True:
                data = await websocket.receive_text()
                try:
                    message = json.loads(data)
                    message_type = message.get("type")
                    if message_type == "ping":
                        await websocket.send_text(json.dumps({"type": "pong", "timestamp": now()}))
                    elif message_type == "session_check":
                        current = await identity_from_websocket(websocket, db)
                        if current:
                            await websocket.send_text(
                                json.dumps(
                                    {
                                        "type": "session_valid",
                                        "data": {
                                            "user": {
                                                "id": current.user.id,
                                                "email": current.user.email,
                                                "name": current.user.name,
                                                "role": current.user.role,
                                                "verified_user": current.user.verified_user,
                                            }
                                        },
                                    }
                                )
                            )
                        else:
                            await manager.notify_session_expired(user_id)
                            break
                except json.JSONDecodeError:
                    logger.warning("Invalid JSON received over WebSocket")
        except WebSocketDisconnect:
            pass
    except Exception:
        logger.exception("WebSocket session error")
        try:
            await websocket.close(code=4000, reason="Internal error")
        except Exception:
            pass
    finally:
        if user_id:
            manager.disconnect(websocket, user_id)


__all__ = ["manager", "router"]
