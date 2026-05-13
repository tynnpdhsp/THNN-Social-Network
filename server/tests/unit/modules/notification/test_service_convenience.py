"""Convenience helpers: early returns, titles, metadata."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from .conftest import make_notification_row


@pytest.mark.asyncio
class TestNotifyLike:
    async def test_empty_target_does_not_call_create(
        self, notification_service, mock_notification_repo, patch_get_redis
    ):
        await notification_service.notify_like("Bob", "", "post-1")
        mock_notification_repo.create.assert_not_awaited()

    async def test_none_target_does_not_call_create(
        self, notification_service, mock_notification_repo, patch_get_redis
    ):
        await notification_service.notify_like("Bob", None, "post-1")  # type: ignore[arg-type]
        mock_notification_repo.create.assert_not_awaited()

    async def test_creates_like_notification(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        mock_notification_repo.create = AsyncMock(
            return_value=make_notification_row(type="like", userId="target")
        )
        await notification_service.notify_like("Alice", "target", "post-99")

        data = mock_notification_repo.create.await_args.kwargs["data"]
        assert data["userId"] == "target"
        assert data["type"] == "like"
        assert data["title"] == "Lượt thích mới"
        assert "Alice" in data["content"] and "thích" in data["content"]


@pytest.mark.asyncio
class TestNotifyComment:
    async def test_empty_target_skips(self, notification_service, mock_notification_repo, patch_get_redis):
        await notification_service.notify_comment("X", "", "p")
        mock_notification_repo.create.assert_not_awaited()

    async def test_creates_comment_notification(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        mock_notification_repo.create = AsyncMock(return_value=make_notification_row(userId="t"))
        await notification_service.notify_comment("Writer", "t", "post-7")

        data = mock_notification_repo.create.await_args.kwargs["data"]
        assert data["type"] == "comment"
        assert data["title"] == "Bình luận mới"
        assert "Writer" in data["content"]


@pytest.mark.asyncio
class TestNotifyReply:
    async def test_empty_target_skips(self, notification_service, mock_notification_repo, patch_get_redis):
        await notification_service.notify_reply("R", "", "pid")
        mock_notification_repo.create.assert_not_awaited()

    async def test_creates_reply_notification(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        mock_notification_repo.create = AsyncMock(return_value=make_notification_row())
        await notification_service.notify_reply("Rep", "u2", "post-2")

        data = mock_notification_repo.create.await_args.kwargs["data"]
        assert data["type"] == "reply"
        assert data["title"] == "Phản hồi mới"


@pytest.mark.asyncio
class TestNotifyFriendRequest:
    async def test_empty_target_skips(self, notification_service, mock_notification_repo, patch_get_redis):
        await notification_service.notify_friend_request("A", "", "actor-1")
        mock_notification_repo.create.assert_not_awaited()

    async def test_metadata_points_to_actor_user(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        mock_notification_repo.create = AsyncMock(return_value=make_notification_row())
        await notification_service.notify_friend_request("Sam", "recv", "actor-55")

        data = mock_notification_repo.create.await_args.kwargs["data"]
        assert data["type"] == "friend_request"
        assert data["metadata"] is not None


@pytest.mark.asyncio
class TestNotifySystem:
    async def test_no_early_return_empty_user_still_calls_create(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        """``notify_system`` does not guard ``target_user_id`` — documents current behaviour."""
        mock_notification_repo.create = AsyncMock(return_value=make_notification_row(userId=""))
        await notification_service.notify_system("", "T", "C")
        mock_notification_repo.create.assert_awaited_once()
        data = mock_notification_repo.create.await_args.kwargs["data"]
        assert data["userId"] == ""
        assert data["type"] == "system"


@pytest.mark.asyncio
class TestNotifyMessage:
    async def test_empty_target_skips(self, notification_service, mock_notification_repo, patch_get_redis):
        await notification_service.notify_message("M", "", "conv", "hi")
        mock_notification_repo.create.assert_not_awaited()

    async def test_title_includes_actor_and_metadata_conversation(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        mock_notification_repo.create = AsyncMock(return_value=make_notification_row())
        await notification_service.notify_message("Jane", "recv", "conv-1", "Hello there")

        data = mock_notification_repo.create.await_args.kwargs["data"]
        assert data["type"] == "message"
        assert "Jane" in data["title"]
        assert data["content"] == "Hello there"
        assert data["metadata"] is not None
