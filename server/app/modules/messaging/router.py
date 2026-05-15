from typing import Optional
import asyncio
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect

from app.core.dependencies import get_current_user_id, require_active_user, get_db
from app.modules.messaging.repository import MessagingRepository
from app.modules.messaging.service import MessagingService
from app.modules.messaging.schemas import (
    PaginatedConversationResponse, PaginatedMessageResponse,
    CreateConversationRequest, SendMessageRequest, MessageResponse,
    ConversationResponse
)
from app.modules.messaging.ws_manager import manager
from app.modules.notification.repository import NotificationRepository
from app.modules.notification.service import NotificationService
from app.core.security import decode_token

router = APIRouter(prefix="/messaging", tags=["Messaging"])

def get_messaging_service(db=Depends(get_db)):
    repo = MessagingRepository(db)
    notif_repo = NotificationRepository(db)
    notif_svc = NotificationService(notif_repo)
    return MessagingService(repo, notif_svc)

@router.get("/conversations", response_model=PaginatedConversationResponse)
async def get_conversations(
    skip: int = 0, limit: int = 20,
    user_id: str = Depends(require_active_user),
    svc: MessagingService = Depends(get_messaging_service)
):
    return await svc.get_conversations(user_id, skip, limit)

@router.get("/conversations/{conv_id}/messages", response_model=PaginatedMessageResponse)
async def get_messages(
    conv_id: str,
    skip: int = 0, limit: int = 50,
    user_id: str = Depends(require_active_user),
    svc: MessagingService = Depends(get_messaging_service)
):
    return await svc.get_messages(user_id, conv_id, skip, limit)

@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    body: CreateConversationRequest,
    user_id: str = Depends(require_active_user),
    svc: MessagingService = Depends(get_messaging_service)
):
    return await svc.create_conversation(user_id, body)

@router.post("/conversations/{conv_id}/messages", response_model=MessageResponse)
async def send_message(
    conv_id: str,
    body: SendMessageRequest,
    user_id: str = Depends(require_active_user),
    svc: MessagingService = Depends(get_messaging_service)
):
    return await svc.send_message(user_id, conv_id, body)

@router.post("/conversations/{conv_id}/read")
async def mark_as_read(
    conv_id: str,
    user_id: str = Depends(require_active_user),
    svc: MessagingService = Depends(get_messaging_service)
):
    return await svc.mark_conversation_as_read(user_id, conv_id)

@router.get("/has-unread")
async def has_unread_messages(
    user_id: str = Depends(require_active_user),
    svc: MessagingService = Depends(get_messaging_service)
):
    return await svc.has_unread_messages(user_id)

# --- WebSocket ---

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(None)):
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    payload = decode_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=4002, reason="Invalid token")
        return

    user_id = payload["sub"]

    # Verify account is not locked
    db = get_db()
    user = await db.user.find_unique(where={"id": user_id})
    if not user or user.isLocked:
        await websocket.close(code=4003, reason="Account locked")
        return

    await manager.connect(user_id, websocket)

    try:
        while True:
            # Use receive with timeout to detect dead connections
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                # Echo back ping if client sends ping
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Send ping to keep connection alive and check if client is still there
                try:
                    await websocket.send_text("ping")
                    # Wait for pong response
                    await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
                except (asyncio.TimeoutError, WebSocketDisconnect):
                    # Client didn't respond, consider disconnected
                    break
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user_id, websocket)
