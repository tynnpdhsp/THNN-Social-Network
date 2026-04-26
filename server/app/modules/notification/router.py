from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_notification_service, require_active_user
from app.modules.account.schemas import MessageResponse
from app.modules.notification.service import NotificationService
from app.modules.notification.schemas import (
    MarkReadRequest,
    NotificationListResponse,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    user_id: str = Depends(require_active_user),
    svc: NotificationService = Depends(get_notification_service),
):
    """Lấy danh sách thông báo của người dùng hiện tại."""
    return await svc.get_notifications(user_id, skip, limit, unread_only)


@router.get("/unread-count")
async def get_unread_count(
    user_id: str = Depends(require_active_user),
    svc: NotificationService = Depends(get_notification_service),
):
    """Lấy số thông báo chưa đọc (badge count)."""
    count = await svc.get_unread_count(user_id)
    return {"unread_count": count}


@router.put("/read", response_model=MessageResponse)
async def mark_as_read(
    body: MarkReadRequest,
    user_id: str = Depends(require_active_user),
    svc: NotificationService = Depends(get_notification_service),
):
    """Đánh dấu đã đọc cho danh sách thông báo cụ thể."""
    count = await svc.mark_as_read(user_id, body.notification_ids)
    return MessageResponse(message=f"Đã đánh dấu {count} thông báo là đã đọc")


@router.put("/read-all", response_model=MessageResponse)
async def mark_all_as_read(
    user_id: str = Depends(require_active_user),
    svc: NotificationService = Depends(get_notification_service),
):
    """Đánh dấu tất cả thông báo đã đọc."""
    count = await svc.mark_all_as_read(user_id)
    return MessageResponse(message=f"Đã đánh dấu tất cả {count} thông báo là đã đọc")


@router.delete("/{notification_id}", response_model=MessageResponse)
async def delete_notification(
    notification_id: str,
    user_id: str = Depends(require_active_user),
    svc: NotificationService = Depends(get_notification_service),
):
    """Xóa một thông báo."""
    await svc.delete_notification(user_id, notification_id)
    return MessageResponse(message="Đã xóa thông báo")


@router.delete("", response_model=MessageResponse)
async def delete_all_notifications(
    user_id: str = Depends(require_active_user),
    svc: NotificationService = Depends(get_notification_service),
):
    """Xóa tất cả thông báo."""
    count = await svc.delete_all(user_id)
    return MessageResponse(message=f"Đã xóa {count} thông báo")
