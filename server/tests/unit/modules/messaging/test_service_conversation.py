"""``MessagingService.create_conversation`` and list mapping."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import BadRequestException, ForbiddenException

from app.modules.messaging.schemas import CreateConversationRequest

from .conftest import make_fake_conv, make_privacy, make_user_row


@pytest.mark.asyncio
class TestCreateConversationDirect:
    async def test_missing_participant_raises(
        self, messaging_service, mock_messaging_repo, mock_db, patch_messaging_embed
    ):
        body = CreateConversationRequest(type="direct", participant_ids=[])

        with pytest.raises(BadRequestException) as exc:
            await messaging_service.create_conversation("u-caller", body)

        assert exc.value.error_code == "MISSING_PARTICIPANT"

    async def test_blocked_raises(
        self, messaging_service, mock_messaging_repo, mock_db, patch_messaging_embed
    ):
        mock_db.userblock.find_first = AsyncMock(return_value=MagicMock())
        body = CreateConversationRequest(type="direct", participant_ids=["u-other"])

        with pytest.raises(ForbiddenException) as exc:
            await messaging_service.create_conversation("u-caller", body)

        assert exc.value.error_code == "USER_BLOCKED"
        mock_messaging_repo.find_direct_conversation.assert_not_awaited()

    async def test_privacy_only_me_raises(
        self, messaging_service, mock_messaging_repo, mock_db, patch_messaging_embed
    ):
        mock_db.userblock.find_first = AsyncMock(return_value=None)
        mock_db.privacysetting.find_unique = AsyncMock(return_value=make_privacy("only_me"))
        body = CreateConversationRequest(type="direct", participant_ids=["u-other"])

        with pytest.raises(ForbiddenException) as exc:
            await messaging_service.create_conversation("u-caller", body)

        assert exc.value.error_code == "MESSAGING_DISABLED"

    async def test_privacy_friends_not_friend_raises(
        self, messaging_service, mock_messaging_repo, mock_db, patch_messaging_embed
    ):
        mock_db.userblock.find_first = AsyncMock(return_value=None)
        mock_db.privacysetting.find_unique = AsyncMock(return_value=make_privacy("friends"))
        mock_db.friendship.find_many = AsyncMock(return_value=[])
        body = CreateConversationRequest(type="direct", participant_ids=["u-other"])

        with pytest.raises(ForbiddenException) as exc:
            await messaging_service.create_conversation("u-caller", body)

        assert exc.value.error_code == "FRIENDS_ONLY_MESSAGE"

    async def test_privacy_friends_when_friends_creates(
        self, messaging_service, mock_messaging_repo, mock_db, patch_messaging_embed
    ):
        mock_db.userblock.find_first = AsyncMock(return_value=None)
        mock_db.privacysetting.find_unique = AsyncMock(return_value=make_privacy("friends"))
        mock_db.friendship.find_many = AsyncMock(
            return_value=[MagicMock(requesterId="u-other", receiverId="u-caller")]
        )
        mock_messaging_repo.find_direct_conversation = AsyncMock(return_value=None)
        created = make_fake_conv(id="new-dm", participantIds=["u-caller", "u-other"])
        mock_messaging_repo.create_conversation = AsyncMock(return_value=created)
        mock_db.user.find_unique = AsyncMock(return_value=make_user_row())

        body = CreateConversationRequest(type="direct", participant_ids=["u-other"])
        res = await messaging_service.create_conversation("u-caller", body)

        mock_messaging_repo.create_conversation.assert_awaited_once()
        assert res.id == "new-dm"

    async def test_returns_existing_dm_without_create(
        self, messaging_service, mock_messaging_repo, mock_db, patch_messaging_embed
    ):
        mock_db.userblock.find_first = AsyncMock(return_value=None)
        mock_db.privacysetting.find_unique = AsyncMock(return_value=None)
        existing = make_fake_conv(id="existing-dm")
        mock_messaging_repo.find_direct_conversation = AsyncMock(return_value=existing)
        mock_db.user.find_unique = AsyncMock(return_value=make_user_row())

        body = CreateConversationRequest(type="direct", participant_ids=["u-other"])
        res = await messaging_service.create_conversation("u-caller", body)

        mock_messaging_repo.create_conversation.assert_not_awaited()
        assert res.id == "existing-dm"

    async def test_new_dm_creates_with_two_members(
        self, messaging_service, mock_messaging_repo, mock_db, patch_messaging_embed
    ):
        mock_db.userblock.find_first = AsyncMock(return_value=None)
        mock_db.privacysetting.find_unique = AsyncMock(return_value=None)
        mock_messaging_repo.find_direct_conversation = AsyncMock(return_value=None)
        created = make_fake_conv(id="dm-new")
        mock_messaging_repo.create_conversation = AsyncMock(return_value=created)
        mock_db.user.find_unique = AsyncMock(return_value=make_user_row())

        body = CreateConversationRequest(type="direct", participant_ids=["u-other"])
        await messaging_service.create_conversation("u-caller", body)

        call_kw = mock_messaging_repo.create_conversation.await_args
        assert call_kw.args[0] == "direct"
        members = call_kw.args[1]
        assert len(members) == 2
        uids = {m["user_id"] for m in members}
        assert uids == {"u-caller", "u-other"}
        assert call_kw.kwargs["participant_ids"] == ["u-caller", "u-other"]


@pytest.mark.asyncio
class TestCreateConversationGroup:
    async def test_group_admin_and_participants(
        self, messaging_service, mock_messaging_repo, mock_db, patch_messaging_embed
    ):
        created = make_fake_conv(
            id="grp-1",
            type="group",
            name="Study",
            members=[
                {"user_id": "admin", "role": "admin"},
                {"user_id": "p1", "role": "member"},
                {"user_id": "p2", "role": "member"},
            ],
            participantIds=["admin", "p1", "p2"],
        )
        mock_messaging_repo.create_conversation = AsyncMock(return_value=created)

        body = CreateConversationRequest(
            type="group",
            name="Study",
            participant_ids=["p1", "p2"],
        )
        res = await messaging_service.create_conversation("admin", body)

        assert res.type == "group"
        call_kw = mock_messaging_repo.create_conversation.await_args
        assert call_kw.args[0] == "group"
        members = call_kw.args[1]
        roles = {m["user_id"]: m["role"] for m in members}
        assert roles["admin"] == "admin"
        assert roles["p1"] == "member"
        assert call_kw.kwargs["participant_ids"] == ["admin", "p1", "p2"]


@pytest.mark.asyncio
class TestGetConversations:
    async def test_pagination_and_maps_direct_other_member(
        self, messaging_service, mock_messaging_repo, mock_db, patch_messaging_embed
    ):
        conv = make_fake_conv()
        mock_messaging_repo.get_user_conversations = AsyncMock(return_value=[conv])
        mock_messaging_repo.count_user_conversations = AsyncMock(return_value=100)
        mock_db.user.find_unique = AsyncMock(return_value=make_user_row())

        out = await messaging_service.get_conversations("u-caller", skip=10, limit=5)

        mock_messaging_repo.get_user_conversations.assert_awaited_once_with("u-caller", 10, 5)
        assert out.total == 100
        assert out.skip == 10
        assert out.limit == 5
        assert len(out.conversations) == 1
        assert out.conversations[0].other_member is not None
        assert out.conversations[0].other_member.id == "u-other"
