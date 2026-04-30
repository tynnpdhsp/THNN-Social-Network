from typing import Optional
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
    await manager.connect(user_id, websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
