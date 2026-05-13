"""
Unit tests for privacy / notification settings on ``AccountService``.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.account.schemas import (
    UpdateNotificationSettingsRequest,
    UpdatePrivacySettingsRequest,
)


def _privacy_row(**kw):
    m = MagicMock()
    m.whoCanSeePosts = kw.get("who_can_see_posts", "everyone")
    m.whoCanMessage = kw.get("who_can_message", "everyone")
    m.whoCanFriendReq = kw.get("who_can_friend_req", "everyone")
    return m


def _notif_row(**kw):
    m = MagicMock()
    for k, v in kw.items():
        setattr(m, k, v)
    defaults = dict(
        notifyLike=True,
        notifyComment=True,
        notifyReply=True,
        notifyFriendReq=True,
        notifyMessage=True,
        notifySchedule=True,
    )
    for k, v in defaults.items():
        if not hasattr(m, k):
            setattr(m, k, v)
    return m


@pytest.mark.asyncio
class TestPrivacySettings:
    async def test_get_creates_defaults_when_missing(
        self, account_service, mock_account_repo, patch_get_redis
    ):
        mock_account_repo.get_privacy_settings.return_value = None
        created = _privacy_row()
        mock_account_repo.create_privacy_settings.return_value = created

        ps = await account_service.get_privacy_settings("new-user")
        assert ps.who_can_see_posts == "everyone"
        mock_account_repo.create_privacy_settings.assert_awaited()
        call_kw = mock_account_repo.create_privacy_settings.await_args.kwargs["data"]
        assert call_kw["userId"] == "new-user"
        assert call_kw["whoCanSeePosts"] == "everyone"

    async def test_get_from_repo_when_cache_empty(
        self, account_service, mock_account_repo, patch_get_redis
    ):
        row = _privacy_row(who_can_see_posts="friends")
        mock_account_repo.get_privacy_settings.return_value = row

        ps = await account_service.get_privacy_settings("u1")
        assert ps.who_can_see_posts == "friends"

    async def test_update_maps_fields(self, account_service, mock_account_repo, patch_get_redis):
        updated = _privacy_row(who_can_see_posts="only_me")
        mock_account_repo.update_privacy_settings.return_value = updated

        ps = await account_service.update_privacy_settings(
            "u1",
            UpdatePrivacySettingsRequest(who_can_see_posts="only_me"),
        )
        assert ps.who_can_see_posts == "only_me"
        mock_account_repo.update_privacy_settings.assert_awaited_with(
            "u1", {"whoCanSeePosts": "only_me"}
        )


@pytest.mark.asyncio
class TestNotificationSettings:
    async def test_get_creates_defaults(self, account_service, mock_account_repo, patch_get_redis):
        mock_account_repo.get_notification_settings.return_value = None
        row = _notif_row()
        mock_account_repo.create_notification_settings.return_value = row

        ns = await account_service.get_notification_settings("nu")
        assert ns.notify_like is True
        mock_account_repo.create_notification_settings.assert_awaited()

    async def test_update_partial(self, account_service, mock_account_repo, patch_get_redis):
        row = _notif_row()
        row.notifyLike = False
        mock_account_repo.update_notification_settings.return_value = row

        ns = await account_service.update_notification_settings(
            "u1",
            UpdateNotificationSettingsRequest(notify_like=False),
        )
        assert ns.notify_like is False
        mock_account_repo.update_notification_settings.assert_awaited_with(
            "u1", {"notifyLike": False}
        )
