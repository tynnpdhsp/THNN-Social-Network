"""Tests for friend requests and related ``SocialService`` APIs."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException
from tests.unit.conftest import make_fake_user
from tests.unit.modules.social.conftest import make_privacy_mock


@pytest.mark.asyncio
class TestSendFriendRequest:
    async def test_blocked_raises(self, social_service, mock_db):
        mock_db.userblock.find_first = AsyncMock(return_value=MagicMock())
        with pytest.raises(ForbiddenException) as e:
            await social_service.send_friend_request("a", "b")
        assert e.value.error_code == "USER_BLOCKED"

    async def test_privacy_no_one(self, social_service, mock_db, patch_social_deps):
        mock_db.userblock.find_first = AsyncMock(return_value=None)
        mock_db.privacysetting.find_unique = AsyncMock(return_value=make_privacy_mock(who_friend_req="no_one"))

        with pytest.raises(ForbiddenException) as e:
            await social_service.send_friend_request("sender", "target-user")
        assert e.value.error_code == "FRIEND_REQUESTS_DISABLED"

    async def test_friends_of_friends_requires_mutual(
        self, social_service, mock_social_repo, mock_db, patch_social_deps
    ):
        mock_db.userblock.find_first = AsyncMock(return_value=None)
        mock_db.privacysetting.find_unique = AsyncMock(
            return_value=make_privacy_mock(who_friend_req="friends_of_friends")
        )
        mock_social_repo.get_friend_ids = AsyncMock(side_effect=[["x"], ["y"]])  # no intersection

        with pytest.raises(ForbiddenException) as e:
            await social_service.send_friend_request("sender", "target-user")
        assert e.value.error_code == "MUTUAL_FRIENDS_ONLY"

    async def test_success_sends_notification(
        self, social_service, mock_social_repo, mock_db, mock_notification_repo, patch_social_deps, patch_get_redis
    ):
        mock_db.userblock.find_first = AsyncMock(return_value=None)
        mock_db.privacysetting.find_unique = AsyncMock(return_value=None)
        mock_social_repo.send_friend_request = AsyncMock()
        mock_db.user.find_unique = AsyncMock(return_value=make_fake_user(id="sender", fullName="S"))

        await social_service.send_friend_request("sender", "target-user")
        mock_social_repo.send_friend_request.assert_awaited_once()
        mock_notification_repo.create.assert_awaited()


@pytest.mark.asyncio
class TestAcceptRejectUnfriend:
    async def test_accept_not_found(self, social_service, mock_social_repo, patch_get_redis):
        mock_social_repo.accept_friend_request = AsyncMock(return_value=None)
        with pytest.raises(NotFoundException):
            await social_service.accept_friend_request("u1", "r1")

    async def test_accept_success_invalidates_cache(
        self, social_service, mock_social_repo, mock_notification_repo, patch_get_redis, patch_social_deps, mock_db
    ):
        mock_social_repo.accept_friend_request = AsyncMock(return_value=MagicMock())
        mock_db.user.find_unique = AsyncMock(return_value=make_fake_user(id="u1", fullName="Accepter"))

        out = await social_service.accept_friend_request("u1", "r1")
        assert "chấp nhận" in out["status"]
        mock_notification_repo.create.assert_awaited()

    async def test_reject(self, social_service, mock_social_repo):
        mock_social_repo.reject_friend_request = AsyncMock(return_value=MagicMock())
        out = await social_service.reject_friend_request("u1", "r1")
        assert "từ chối" in out["status"]

    async def test_unfriend(self, social_service, mock_social_repo, patch_get_redis):
        mock_social_repo.remove_friendship = AsyncMock(return_value=True)
        out = await social_service.unfriend("a", "b")
        assert "hủy" in out["status"]


@pytest.mark.asyncio
class TestListFriends:
    async def test_empty(self, social_service, mock_social_repo):
        mock_social_repo.get_friend_ids = AsyncMock(return_value=[])
        assert await social_service.list_friends("u") == []

    async def test_resolves_users(self, social_service, mock_social_repo, mock_db, patch_social_deps):
        mock_social_repo.get_friend_ids = AsyncMock(return_value=["f1"])
        mock_db.user.find_many = AsyncMock(return_value=[make_fake_user(id="f1", fullName="Friend")])

        rows = await social_service.list_friends("me")
        assert rows[0]["id"] == "f1"
        assert rows[0]["full_name"] == "Friend"


@pytest.mark.asyncio
class TestListIncoming:
    async def test_maps_requesters(self, social_service, mock_social_repo):
        req = MagicMock()
        req.requesterId = "r1"
        req.requester = make_fake_user(id="r1", fullName="Req")
        req.createdAt = MagicMock()
        mock_social_repo.get_incoming_friend_requests = AsyncMock(return_value=[req])

        out = await social_service.list_incoming_friend_requests("u1")
        assert out[0]["from_id"] == "r1"
        assert out[0]["full_name"] == "Req"
