"""Tests for block / unblock / report ``SocialService`` APIs."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.mark.asyncio
class TestBlockUser:
    async def test_swallows_duplicate_block_still_unfriends(
        self, social_service, mock_social_repo, patch_get_redis
    ):
        mock_social_repo.block_user = AsyncMock(side_effect=Exception("duplicate"))
        mock_social_repo.remove_friendship = AsyncMock(return_value=True)

        out = await social_service.block_user("a", "b")
        assert out["status"] == "đã chặn"
        mock_social_repo.remove_friendship.assert_awaited_once_with("a", "b")


@pytest.mark.asyncio
class TestListUnblock:
    async def test_list_blocked(self, social_service, mock_social_repo):
        row = MagicMock()
        row.blockedId = "b1"
        row.blocked = MagicMock()
        row.blocked.fullName = "Blocked User"
        mock_social_repo.get_blocked_users = AsyncMock(return_value=[row])

        out = await social_service.list_blocked("me")
        assert out[0]["blocked_id"] == "b1"

    async def test_unblock(self, social_service, mock_social_repo):
        mock_social_repo.unblock_user = AsyncMock()
        out = await social_service.unblock_user("me", "b1")
        assert "bỏ chặn" in out["status"]


@pytest.mark.asyncio
class TestReportContent:
    async def test_returns_report_id(self, social_service, mock_social_repo):
        rep = MagicMock()
        rep.id = "rep-1"
        rep.status = "open"
        mock_social_repo.create_report = AsyncMock(return_value=rep)

        out = await social_service.report_content("r1", "post", "p1", "spam", None)
        assert out["report_id"] == "rep-1"
        assert out["status"] == "open"
