"""Unit tests for ``create_notification`` (metadata, cache, Redis publish)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest
from prisma import Json

from app.modules.notification.schemas import (
    CreateNotificationRequest,
    NotificationMetadata,
)

from .conftest import make_notification_row


@pytest.mark.asyncio
class TestCreateNotification:
    async def test_without_metadata_passes_none_to_repo(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        created_row = make_notification_row(metadata=None, userId="u-1", id="n-new")
        mock_notification_repo.create = AsyncMock(return_value=created_row)

        req = CreateNotificationRequest(
            user_id="u-1",
            type="system",
            title="Sys",
            content="Msg",
        )
        res = await notification_service.create_notification(req)

        mock_notification_repo.create.assert_awaited_once()
        data = mock_notification_repo.create.await_args.kwargs["data"]
        assert data["userId"] == "u-1"
        assert data["type"] == "system"
        assert data["title"] == "Sys"
        assert data["content"] == "Msg"
        assert data["metadata"] is None
        assert res.user_id == "u-1"

    async def test_with_metadata_wraps_prisma_json(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        created_row = make_notification_row(
            metadata={"reference_id": "p1", "reference_type": "post"},
        )
        mock_notification_repo.create = AsyncMock(return_value=created_row)

        req = CreateNotificationRequest(
            user_id="u-2",
            type="like",
            title="Like",
            content="Someone liked",
            metadata=NotificationMetadata(reference_id="p1", reference_type="post"),
        )
        await notification_service.create_notification(req)

        data = mock_notification_repo.create.await_args.kwargs["data"]
        assert isinstance(data["metadata"], Json)
        raw = data["metadata"]
        inner = getattr(raw, "data", raw)
        if not isinstance(inner, dict):
            inner = json.loads(json.dumps(inner, default=str))
        assert inner["reference_id"] == "p1"
        assert inner["reference_type"] == "post"

    async def test_invalidates_unread_cache(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        await mock_redis.set("notif:unread:u-3", "5")
        mock_notification_repo.create = AsyncMock(return_value=make_notification_row(userId="u-3"))

        req = CreateNotificationRequest(
            user_id="u-3",
            type="system",
            title="T",
            content="C",
        )
        await notification_service.create_notification(req)

        assert await mock_redis.get("notif:unread:u-3") is None

    async def test_publishes_realtime_payload_on_chat_updates(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        row = make_notification_row(id="n-99", userId="u-4", type="message", title="Hi", content="Body")
        mock_notification_repo.create = AsyncMock(return_value=row)

        mock_pub = AsyncMock(return_value=0)
        with patch.object(mock_redis, "publish", mock_pub):
            await notification_service.create_notification(
                CreateNotificationRequest(
                    user_id="u-4",
                    type="message",
                    title="Hi",
                    content="Body",
                )
            )

        mock_pub.assert_awaited_once()
        args = mock_pub.await_args[0]
        assert args[0] == "chat_updates"
        envelope = json.loads(args[1])
        assert envelope["target_user_ids"] == ["u-4"]
        assert envelope["payload"]["type"] == "new_notification"
        assert envelope["payload"]["data"]["id"] == "n-99"

    async def test_publish_failure_still_returns_mapped_response(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        row = make_notification_row(id="ok-id", userId="u-5")
        mock_notification_repo.create = AsyncMock(return_value=row)
        mock_pub = AsyncMock(side_effect=RuntimeError("redis down"))

        with patch.object(mock_redis, "publish", mock_pub):
            res = await notification_service.create_notification(
                CreateNotificationRequest(
                    user_id="u-5",
                    type="system",
                    title="T",
                    content="C",
                )
            )

        assert res.id == "ok-id"
        mock_pub.assert_awaited()
