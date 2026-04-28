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

# --- WebSocket ---

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    # In a real app, we should verify the token here (e.g. from query param)
    # For now, we trust the user_id for testing
    await manager.connect(user_id, websocket)
    try:
        while True:
            # Keep connection alive and handle incoming heartbeats if needed
            data = await websocket.receive_text()
            # We don't handle client-to-server chat via WS (we use REST for that)
            # but we could echo or handle commands here
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
