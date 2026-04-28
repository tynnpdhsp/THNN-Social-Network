from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ─── Notification Types ───────────────────────────────────────────────────────
# 'like' | 'comment' | 'reply' | 'friend_request' | 'message' | 'system'


class NotificationMetadata(BaseModel):
    """Metadata đính kèm thông báo, dùng để điều hướng trên frontend."""
    reference_id: Optional[str] = None  # ID bài viết, comment, user...
    reference_type: Optional[str] = None  # 'post' | 'comment' | 'user' | 'conversation'


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str  # 'like' | 'comment' | 'reply' | 'friend_request' | 'message' | 'system'
    title: str
    content: str
    metadata: Optional[NotificationMetadata] = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    unread_count: int


class MarkReadRequest(BaseModel):
    notification_ids: List[str] = Field(..., min_length=1, max_length=100)


class CreateNotificationRequest(BaseModel):
    """Internal schema — dùng trong service layer, không expose ra API."""
    user_id: str
    type: str
    title: str
    content: str
    metadata: Optional[NotificationMetadata] = None
