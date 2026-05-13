"""
Unit tests for profile-related ``AccountService`` methods.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.cache import get_user_profile_cache, set_user_profile_cache
from app.core.exceptions import BadRequestException, NotFoundException
from app.modules.account.schemas import UpdateProfileRequest
from tests.unit.conftest import make_fake_user, make_fake_role


def _profile_db_user(uid="p-1", **kw):
    defaults = dict(
        id=uid,
        email="p@p.com",
        fullName="Prof",
        phoneNumber="0901111222",
        bio="Bio",
        avatarUrl="/a.jpg",
        coverUrl="/c.jpg",
        roleId="role-1",
        emailVerified=True,
        deletedAt=None,
        createdAt=datetime(2025, 6, 1, tzinfo=timezone.utc),
    )
    defaults.update(kw)
    return make_fake_user(**defaults)


@pytest.mark.asyncio
class TestGetProfile:
    async def test_not_found(self, account_service, mock_account_repo, patch_get_redis):
        mock_account_repo.get_user_by_id.return_value = None
        with pytest.raises(NotFoundException) as e:
            await account_service.get_profile("missing")
        assert e.value.error_code == "USER_NOT_FOUND"

    async def test_cache_hit_skips_db_user_fetch(
        self, account_service, mock_account_repo, patch_get_redis
    ):
        uid = "cached-user"
        payload = {
            "id": uid,
            "email": "c@c.com",
            "full_name": "Cached",
            "phone_number": "0901234567",
            "bio": None,
            "avatar_url": None,
            "cover_url": None,
            "role": "student",
            "email_verified": True,
            "created_at": datetime(2025, 1, 1, tzinfo=timezone.utc).isoformat(),
            "friend_status": None,
        }
        await set_user_profile_cache(uid, payload)

        mock_account_repo.get_user_by_id.reset_mock()
        p = await account_service.get_profile(uid, requesting_user_id=None)
        assert p.full_name == "Cached"
        mock_account_repo.get_user_by_id.assert_not_called()

    async def test_cache_bypassed_when_requesting_user_present(
        self, account_service, mock_account_repo, patch_get_redis
    ):
        uid = "u-live"
        user = _profile_db_user(uid=uid)
        mock_account_repo.get_user_by_id.return_value = user
        role = make_fake_role(role="student")
        mock_account_repo.db.role.find_unique = AsyncMock(return_value=role)
        mock_account_repo.db.friendship.find_first = AsyncMock(return_value=None)

        await set_user_profile_cache(uid, {"id": uid, "full_name": "Stale", "email": "x@x.com"})

        p = await account_service.get_profile(uid, requesting_user_id="other")
        assert p.full_name == "Prof"
        mock_account_repo.get_user_by_id.assert_awaited()

    async def test_friendship_pending_received(self, account_service, mock_account_repo, patch_get_redis):
        uid = "target"
        user = _profile_db_user(uid=uid)
        mock_account_repo.get_user_by_id.return_value = user
        mock_account_repo.db.role.find_unique = AsyncMock(return_value=make_fake_role(role="student"))
        fr = MagicMock()
        fr.status = "pending"
        fr.requesterId = uid
        fr.receiverId = "viewer"
        mock_account_repo.db.friendship.find_first = AsyncMock(return_value=fr)

        p = await account_service.get_profile(uid, requesting_user_id="viewer")
        assert p.friend_status == "pending_received"


@pytest.mark.asyncio
class TestUpdateProfile:
    async def test_empty_body(self, account_service):
        with pytest.raises(BadRequestException) as e:
            await account_service.update_profile("u1", UpdateProfileRequest())
        assert e.value.error_code == "EMPTY_UPDATE"

    async def test_updates_maps_fields_and_invalidates_cache(
        self, account_service, mock_account_repo, patch_get_redis
    ):
        uid = "u-up"
        updated = _profile_db_user(uid=uid, fullName="New Name", phoneNumber="0909999888")
        mock_account_repo.update_user.return_value = updated
        mock_account_repo.get_user_by_id.return_value = updated
        mock_account_repo.db.role.find_unique = AsyncMock(return_value=make_fake_role(role="student"))
        mock_account_repo.db.friendship.find_first = AsyncMock(return_value=None)

        await set_user_profile_cache(uid, {"id": uid, "full_name": "Old", "email": "e@e.com"})

        p = await account_service.update_profile(
            uid,
            UpdateProfileRequest(full_name="New Name", phone_number="0909999888"),
        )
        assert p.full_name == "New Name"
        call = mock_account_repo.update_user.await_args
        assert call[0][1]["fullName"] == "New Name"
        assert call[0][1]["phoneNumber"] == "0909999888"
        cached = await get_user_profile_cache(uid)
        assert cached is not None
        assert cached["full_name"] == "New Name"


@pytest.mark.asyncio
class TestUpdateAvatarCover:
    async def test_update_avatar(self, account_service, mock_account_repo, patch_get_redis):
        uid = "av"
        u = _profile_db_user(uid=uid)
        mock_account_repo.update_user.return_value = u
        mock_account_repo.get_user_by_id.return_value = u
        mock_account_repo.db.role.find_unique = AsyncMock(return_value=make_fake_role(role="student"))
        mock_account_repo.db.friendship.find_first = AsyncMock(return_value=None)

        p = await account_service.update_avatar(uid, "/new.png")
        mock_account_repo.update_user.assert_awaited_with(uid, {"avatarUrl": "/new.png"})
        assert p.id == uid

    async def test_update_cover(self, account_service, mock_account_repo, patch_get_redis):
        uid = "cv"
        u = _profile_db_user(uid=uid)
        mock_account_repo.update_user.return_value = u
        mock_account_repo.get_user_by_id.return_value = u
        mock_account_repo.db.role.find_unique = AsyncMock(return_value=make_fake_role(role="student"))
        mock_account_repo.db.friendship.find_first = AsyncMock(return_value=None)

        p = await account_service.update_cover(uid, "/cover.jpg")
        mock_account_repo.update_user.assert_awaited_with(uid, {"coverUrl": "/cover.jpg"})
        assert p.id == uid
