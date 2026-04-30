import logging
from typing import List, Optional

from prisma import Json

from app.core.exceptions import NotFoundException, ForbiddenException
from app.core.redis import get_redis
from app.modules.notification.repository import NotificationRepository
from app.modules.notification.schemas import (
    CreateNotificationRequest,
    NotificationListResponse,
    NotificationMetadata,
    NotificationResponse,
)

logger = logging.getLogger(__name__)

# Redis key cho badge count (số thông báo chưa đọc)
_UNREAD_KEY = "notif:unread:{user_id}"


class NotificationService:
    def __init__(self, repo: NotificationRepository):
        self.repo = repo

    # ─── Query ─────────────────────────────────────────────────────────────

    async def get_notifications(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
        unread_only: bool = False,
    ) -> NotificationListResponse:
        notifications = await self.repo.get_by_user(user_id, skip, limit, unread_only)
        total = await self.repo.count_by_user(user_id)
        unread_count = await self._get_unread_count(user_id)

        items = [self._map_to_response(n) for n in notifications]
        return NotificationListResponse(
            notifications=items,
            total=total,
            unread_count=unread_count,
        )

    async def get_unread_count(self, user_id: str) -> int:
        return await self._get_unread_count(user_id)

    # ─── Mark Read ─────────────────────────────────────────────────────────

    async def mark_as_read(self, user_id: str, notification_ids: List[str]) -> int:
        count = await self.repo.mark_many_as_read(notification_ids, user_id)
        await self._invalidate_unread_cache(user_id)
        return count

    async def mark_all_as_read(self, user_id: str) -> int:
        count = await self.repo.mark_all_as_read(user_id)
        await self._invalidate_unread_cache(user_id)
        return count

    # ─── Delete ────────────────────────────────────────────────────────────

    async def delete_notification(self, user_id: str, notification_id: str) -> None:
        notif = await self.repo.get_by_id(notification_id)
        if notif is None:
            raise NotFoundException("Không tìm thấy thông báo", "NOTIFICATION_NOT_FOUND")
        if notif.userId != user_id:
            raise ForbiddenException("Không có quyền thực hiện", "NOT_AUTHORIZED")
        await self.repo.delete_notification(notification_id)
        await self._invalidate_unread_cache(user_id)

    async def delete_all(self, user_id: str) -> int:
        count = await self.repo.delete_all_by_user(user_id)
        await self._invalidate_unread_cache(user_id)
        return count

    # ─── Create (Internal — called by other services) ──────────────────────

    async def create_notification(self, req: CreateNotificationRequest) -> NotificationResponse:
        metadata_dict = req.metadata.model_dump() if req.metadata else None

        notif = await self.repo.create(data={
            "userId": req.user_id,
            "type": req.type,
            "title": req.title,
            "content": req.content,
            "metadata": Json(metadata_dict) if metadata_dict else None,
        })

        await self._invalidate_unread_cache(req.user_id)
        logger.info("Notification created: type=%s user=%s", req.type, req.user_id)
        return self._map_to_response(notif)

    # ─── Convenience helpers cho Social module ─────────────────────────────

    async def notify_like(self, actor_name: str, target_user_id: str, post_id: str) -> None:
        """Tạo thông báo khi ai đó like bài viết."""
        if not target_user_id:
            return
        await self.create_notification(CreateNotificationRequest(
            user_id=target_user_id,
            type="like",
            title="Lượt thích mới",
            content=f"{actor_name} đã thích bài viết của bạn.",
            metadata=NotificationMetadata(reference_id=post_id, reference_type="post"),
        ))

    async def notify_comment(self, actor_name: str, target_user_id: str, post_id: str) -> None:
        """Tạo thông báo khi ai đó comment bài viết."""
        if not target_user_id:
            return
        await self.create_notification(CreateNotificationRequest(
            user_id=target_user_id,
            type="comment",
            title="Bình luận mới",
            content=f"{actor_name} đã bình luận bài viết của bạn.",
            metadata=NotificationMetadata(reference_id=post_id, reference_type="post"),
        ))

    async def notify_reply(self, actor_name: str, target_user_id: str, post_id: str) -> None:
        """Tạo thông báo khi ai đó reply comment."""
        if not target_user_id:
            return
        await self.create_notification(CreateNotificationRequest(
            user_id=target_user_id,
            type="reply",
            title="Phản hồi mới",
            content=f"{actor_name} đã phản hồi bình luận của bạn.",
            metadata=NotificationMetadata(reference_id=post_id, reference_type="post"),
        ))

    async def notify_friend_request(self, actor_name: str, target_user_id: str, actor_id: str) -> None:
        """Tạo thông báo khi nhận lời mời kết bạn."""
        if not target_user_id:
            return
        await self.create_notification(CreateNotificationRequest(
            user_id=target_user_id,
            type="friend_request",
            title="Lời mời kết bạn",
            content=f"{actor_name} đã gửi lời mời kết bạn.",
            metadata=NotificationMetadata(reference_id=actor_id, reference_type="user"),
        ))

    async def notify_system(self, target_user_id: str, title: str, content: str) -> None:
        """Tạo thông báo hệ thống."""
        await self.create_notification(CreateNotificationRequest(
            user_id=target_user_id,
            type="system",
            title=title,
            content=content,
        ))

    async def notify_message(self, actor_name: str, target_user_id: str, conv_id: str, content: str) -> None:
        """Tạo thông báo khi có tin nhắn mới."""
        if not target_user_id:
            return
        await self.create_notification(CreateNotificationRequest(
            user_id=target_user_id,
            type="message",
            title=f"Tin nhắn mới từ {actor_name}",
            content=content,
            metadata=NotificationMetadata(reference_id=conv_id, reference_type="conversation"),
        ))

    # ─── Private helpers ───────────────────────────────────────────────────

    async def _get_unread_count(self, user_id: str) -> int:
        r = await get_redis()
        key = _UNREAD_KEY.format(user_id=user_id)
        cached = await r.get(key)
        if cached is not None:
            return int(cached)

        count = await self.repo.count_unread(user_id)
        await r.set(key, str(count), ex=300)  # cache 5 phút
        return count

    async def _invalidate_unread_cache(self, user_id: str) -> None:
        r = await get_redis()
        await r.delete(_UNREAD_KEY.format(user_id=user_id))

    def _map_to_response(self, notif) -> NotificationResponse:
        metadata = None
        if notif.metadata and isinstance(notif.metadata, dict):
            metadata = NotificationMetadata(
                reference_id=notif.metadata.get("reference_id"),
                reference_type=notif.metadata.get("reference_type"),
            )

        return NotificationResponse(
            id=notif.id,
            user_id=notif.userId,
            type=notif.type,
            title=notif.title,
            content=notif.content,
            metadata=metadata,
            is_read=notif.isRead,
            created_at=notif.createdAt,
        )
