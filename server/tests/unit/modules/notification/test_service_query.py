"""Unit tests for notification query paths: list + unread count cache."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from .conftest import make_notification_row


@pytest.mark.asyncio
class TestGetNotifications:
    async def test_maps_rows_and_totals(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        rows = [
            make_notification_row(id="a", userId="u1", title="One"),
            make_notification_row(id="b", userId="u1", title="Two"),
        ]
        mock_notification_repo.get_by_user = AsyncMock(return_value=rows)
        mock_notification_repo.count_by_user = AsyncMock(return_value=42)
        mock_notification_repo.count_unread = AsyncMock(return_value=7)

        out = await notification_service.get_notifications("u1", skip=5, limit=10, unread_only=True)

        mock_notification_repo.get_by_user.assert_awaited_once_with("u1", 5, 10, True)
        mock_notification_repo.count_by_user.assert_awaited_once_with("u1")
        assert len(out.notifications) == 2
        assert out.notifications[0].id == "a"
        assert out.notifications[1].id == "b"
        assert out.total == 42
        assert out.unread_count == 7

    async def test_unread_count_uses_redis_cache_hit(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        await mock_redis.set("notif:unread:alice", "99")
        mock_notification_repo.get_by_user = AsyncMock(return_value=[])
        mock_notification_repo.count_by_user = AsyncMock(return_value=0)

        out = await notification_service.get_notifications("alice")

        mock_notification_repo.count_unread.assert_not_awaited()
        assert out.unread_count == 99

    async def test_unread_count_cache_miss_fetches_db_and_sets_redis(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        mock_notification_repo.get_by_user = AsyncMock(return_value=[])
        mock_notification_repo.count_by_user = AsyncMock(return_value=0)
        mock_notification_repo.count_unread = AsyncMock(return_value=3)

        out = await notification_service.get_notifications("bob")

        mock_notification_repo.count_unread.assert_awaited_once_with("bob")
        assert out.unread_count == 3
        cached = await mock_redis.get("notif:unread:bob")
        assert cached == "3"


@pytest.mark.asyncio
class TestGetUnreadCountPublic:
    async def test_delegates_to_internal_cache_logic(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        mock_notification_repo.count_unread = AsyncMock(return_value=11)

        n = await notification_service.get_unread_count("carol")

        assert n == 11
        assert await mock_redis.get("notif:unread:carol") == "11"

    async def test_second_call_uses_cache_without_second_db_hit(
        self, notification_service, mock_notification_repo, patch_get_redis, mock_redis
    ):
        mock_notification_repo.count_unread = AsyncMock(return_value=5)

        assert await notification_service.get_unread_count("dave") == 5
        mock_notification_repo.count_unread.assert_awaited_once()

        mock_notification_repo.count_unread.reset_mock()
        assert await notification_service.get_unread_count("dave") == 5
        mock_notification_repo.count_unread.assert_not_awaited()
