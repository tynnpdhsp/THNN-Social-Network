"""``has_unread_messages`` and ``mark_conversation_as_read``."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException

from .conftest import make_fake_conv


@pytest.mark.asyncio
class TestHasUnreadMessages:
    async def test_false_when_no_conversations(
        self, messaging_service, mock_messaging_repo, patch_messaging_embed
    ):
        mock_messaging_repo.get_user_conversations = AsyncMock(return_value=[])

        out = await messaging_service.has_unread_messages("u1")

        assert out == {"has_unread": False}

    async def test_true_when_last_message_newer_than_last_read(
        self, messaging_service, mock_messaging_repo, patch_messaging_embed
    ):
        conv = make_fake_conv(
            members=[
                {
                    "user_id": "u1",
                    "last_read_at": "2020-01-01T00:00:00+00:00",
                }
            ],
            lastMessage={
                "content": "new",
                "sender_id": "u2",
                "created_at": "2026-01-02T00:00:00+00:00",
            },
        )
        mock_messaging_repo.get_user_conversations = AsyncMock(return_value=[conv])

        out = await messaging_service.has_unread_messages("u1")

        assert out == {"has_unread": True}

    async def test_false_when_last_read_covers_last_message(
        self, messaging_service, mock_messaging_repo, patch_messaging_embed
    ):
        conv = make_fake_conv(
            members=[
                {
                    "user_id": "u1",
                    "last_read_at": "2026-06-10T12:00:00+00:00",
                }
            ],
            lastMessage={
                "content": "old",
                "sender_id": "u2",
                "created_at": "2026-01-01T00:00:00+00:00",
            },
        )
        mock_messaging_repo.get_user_conversations = AsyncMock(return_value=[conv])

        out = await messaging_service.has_unread_messages("u1")

        assert out == {"has_unread": False}

    async def test_true_respects_last_read_at_camel_case(
        self, messaging_service, mock_messaging_repo, patch_messaging_embed
    ):
        conv = make_fake_conv(
            members=[{"userId": "u1", "lastReadAt": "2020-01-01T00:00:00+00:00"}],
            lastMessage={
                "content": "n",
                "sender_id": "u2",
                "created_at": "2026-01-02T00:00:00+00:00",
            },
        )
        mock_messaging_repo.get_user_conversations = AsyncMock(return_value=[conv])

        out = await messaging_service.has_unread_messages("u1")

        assert out == {"has_unread": True}
        conv = make_fake_conv(members=[{"user_id": "someone-else"}])
        conv.lastMessage = {"content": "x", "sender_id": "u2", "created_at": "2026-01-01T00:00:00+00:00"}
        mock_messaging_repo.get_user_conversations = AsyncMock(return_value=[conv])

        out = await messaging_service.has_unread_messages("u1")

        assert out == {"has_unread": False}


@pytest.mark.asyncio
class TestMarkConversationAsRead:
    async def test_not_found(self, messaging_service, mock_messaging_repo, patch_messaging_embed):
        mock_messaging_repo.get_conversation_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await messaging_service.mark_conversation_as_read("u1", "missing")

    async def test_not_member(self, messaging_service, mock_messaging_repo, patch_messaging_embed):
        conv = make_fake_conv(participantIds=["only-other"])
        mock_messaging_repo.get_conversation_by_id = AsyncMock(return_value=conv)

        with pytest.raises(ForbiddenException) as exc:
            await messaging_service.mark_conversation_as_read("u1", "conv-1")

        assert exc.value.error_code == "NOT_A_MEMBER"

    async def test_success_calls_repo(
        self, messaging_service, mock_messaging_repo, patch_messaging_embed
    ):
        conv = make_fake_conv()
        mock_messaging_repo.get_conversation_by_id = AsyncMock(return_value=conv)
        mock_messaging_repo.update_member_last_read = AsyncMock()

        out = await messaging_service.mark_conversation_as_read("u-caller", "conv-1")

        assert out == {"status": "success"}
        mock_messaging_repo.update_member_last_read.assert_awaited_once_with(
            "conv-1", "u-caller"
        )

    async def test_member_allowed_via_participant_ids_when_attr_present(
        self, messaging_service, mock_messaging_repo, patch_messaging_embed
    ):
        conv = make_fake_conv(members=[], participantIds=["u-caller", "x"])
        mock_messaging_repo.get_conversation_by_id = AsyncMock(return_value=conv)
        mock_messaging_repo.update_member_last_read = AsyncMock()

        await messaging_service.mark_conversation_as_read("u-caller", "conv-1")

        mock_messaging_repo.update_member_last_read.assert_awaited_once()
