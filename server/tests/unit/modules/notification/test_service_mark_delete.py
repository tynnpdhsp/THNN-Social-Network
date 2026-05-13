"""Mark read / delete notification service behaviour."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException

from .conftest import make_notification_row


@pytest.mark.asyncio
class TestMarkAsRead:
    async def test_marks_many_and_invalidates_unread_cache(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        await mock_redis.set("notif:unread:user-x", "10")
        mock_notification_repo.mark_many_as_read = AsyncMock(return_value=2)

        n = await notification_service.mark_as_read("user-x", ["a", "b"])

        assert n == 2
        mock_notification_repo.mark_many_as_read.assert_awaited_once_with(["a", "b"], "user-x")
        assert await mock_redis.get("notif:unread:user-x") is None


@pytest.mark.asyncio
class TestMarkAllAsRead:
    async def test_marks_all_and_invalidates(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        await mock_redis.set("notif:unread:user-y", "1")
        mock_notification_repo.mark_all_as_read = AsyncMock(return_value=5)

        n = await notification_service.mark_all_as_read("user-y")

        assert n == 5
        mock_notification_repo.mark_all_as_read.assert_awaited_once_with("user-y")
        assert await mock_redis.get("notif:unread:user-y") is None


@pytest.mark.asyncio
class TestDeleteNotification:
    async def test_not_found_raises(
        self, notification_service, mock_notification_repo, patch_get_redis
    ):
        mock_notification_repo.get_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await notification_service.delete_notification("user-1", "missing-id")

        assert exc.value.error_code == "NOTIFICATION_NOT_FOUND"
        mock_notification_repo.delete_notification.assert_not_awaited()

    async def test_wrong_owner_forbidden(
        self, notification_service, mock_notification_repo, patch_get_redis
    ):
        row = make_notification_row(id="n1", userId="other-user")
        mock_notification_repo.get_by_id = AsyncMock(return_value=row)

        with pytest.raises(ForbiddenException) as exc:
            await notification_service.delete_notification("user-1", "n1")

        assert exc.value.error_code == "NOT_AUTHORIZED"
        mock_notification_repo.delete_notification.assert_not_awaited()

    async def test_success_deletes_and_invalidates(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        await mock_redis.set("notif:unread:user-1", "3")
        row = make_notification_row(id="n1", userId="user-1")
        mock_notification_repo.get_by_id = AsyncMock(return_value=row)
        mock_notification_repo.delete_notification = AsyncMock()

        await notification_service.delete_notification("user-1", "n1")

        mock_notification_repo.delete_notification.assert_awaited_once_with("n1")
        assert await mock_redis.get("notif:unread:user-1") is None


@pytest.mark.asyncio
class TestDeleteAll:
    async def test_deletes_all_returns_count_and_invalidates(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        await mock_redis.set("notif:unread:user-z", "7")
        mock_notification_repo.delete_all_by_user = AsyncMock(return_value=12)

        n = await notification_service.delete_all("user-z")

        assert n == 12
        mock_notification_repo.delete_all_by_user.assert_awaited_once_with("user-z")
        assert await mock_redis.get("notif:unread:user-z") is None
