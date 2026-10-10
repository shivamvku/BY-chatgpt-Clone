"""WebSocket endpoints for real-time communication."""
import json
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import now
from app.services.security import identity_from_websocket

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])

# Store active WebSocket connections per user
active_connections: dict[str, set[WebSocket]] = {}


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"WebSocket connected for user {user_id}")
        
        # Send initial session status
        await self.send_personal_message(user_id, {
            "type": "session_status",
            "data": {"status": "connected", "timestamp": now()}
        })

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"WebSocket disconnected for user {user_id}")

    async def send_personal_message(self, user_id: str, message: dict):
        """Send message to all connections for a specific user."""
        if user_id not in self.active_connections:
            return
        
        message_text = json.dumps(message)
        disconnected = set()
        
        for websocket in self.active_connections[user_id].copy():
            try:
                await websocket.send_text(message_text)
            except Exception as e:
                logger.warning(f"Failed to send message to user {user_id}: {e}")
                disconnected.add(websocket)
        
        # Clean up disconnected websockets
        for ws in disconnected:
            self.active_connections[user_id].discard(ws)
        
        if not self.active_connections[user_id]:
            del self.active_connections[user_id]

    async def broadcast_to_user(self, user_id: str, event_type: str, data: dict):
        """Broadcast an event to all connections for a user."""
        await self.send_personal_message(user_id, {
            "type": event_type,
            "data": data
        })

    async def notify_session_expired(self, user_id: str):
        """Notify user of session expiration."""
        await self.broadcast_to_user(user_id, "session_expired", {
            "message": "Your session has expired. Please log in again.",
            "timestamp": now()
        })

    async def notify_logout(self, user_id: str, reason: str = "logout"):
        """Notify user of logout."""
        await self.broadcast_to_user(user_id, "logout", {
            "reason": reason,
            "timestamp": now()
        })


manager = ConnectionManager()


@router.websocket("/session")
async def websocket_session(
    websocket: WebSocket,
    db: Session = Depends(get_db)
):
    """WebSocket endpoint for session management."""
    try:
        # Get user identity from WebSocket (cookies)
        current = await identity_from_websocket(websocket, db)
        if not current:
            await websocket.close(code=4001, reason="Unauthorized")
            return
        
        user_id = current.user.id
        await manager.connect(websocket, user_id)
        
        try:
            while True:
                # Keep connection alive and handle any client messages
                data = await websocket.receive_text()
                try:
                    message = json.loads(data)
                    message_type = message.get("type")
                    
                    if message_type == "ping":
                        await websocket.send_text(json.dumps({
                            "type": "pong",
                            "timestamp": now()
                        }))
                    elif message_type == "session_check":
                        # Refresh session validity
                        current = await identity_from_websocket(websocket, db)
                        if current:
                            await websocket.send_text(json.dumps({
                                "type": "session_valid",
                                "data": {
                                    "user": {
                                        "id": current.user.id,
                                        "email": current.user.email,
                                        "name": current.user.name,
                                        "role": current.user.role,
                                        "verified_user": current.user.verified_user
                                    }
                                }
                            }))
                        else:
                            await manager.notify_session_expired(user_id)
                            break
                            
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON received from user {user_id}")
                    
        except WebSocketDisconnect:
            manager.disconnect(websocket, user_id)
            
    except Exception as e:
        logger.error(f"WebSocket session error: {e}")
        await websocket.close(code=4000, reason="Internal error")
        if 'user_id' in locals():
            manager.disconnect(websocket, user_id)


# Export manager for use in other modules
__all__ = ["manager", "router"]