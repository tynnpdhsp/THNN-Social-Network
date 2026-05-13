"""``get_messages`` and ``send_message``."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException

from app.modules.messaging.schemas import SendMessageRequest

from .conftest import make_fake_conv, make_fake_message


@pytest.mark.asyncio
class TestGetMessages:
    async def test_conversation_not_found(
        self, messaging_service, mock_messaging_repo, patch_messaging_embed
    ):
        mock_messaging_repo.get_conversation_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await messaging_service.get_messages("u1", "missing")

        assert exc.value.error_code == "CONVERSATION_NOT_FOUND"

    async def test_not_member_forbidden(
        self, messaging_service, mock_messaging_repo, patch_messaging_embed
    ):
        conv = make_fake_conv(
            members=[{"user_id": "a", "role": "member"}],
            participantIds=["a"],
        )
        mock_messaging_repo.get_conversation_by_id = AsyncMock(return_value=conv)

        with pytest.raises(ForbiddenException) as exc:
            await messaging_service.get_messages("intruder", "conv-1")

        assert exc.value.error_code == "NOT_A_MEMBER"

    async def test_returns_messages(
        self, messaging_service, mock_messaging_repo, patch_messaging_embed
    ):
        conv = make_fake_conv()
        mock_messaging_repo.get_conversation_by_id = AsyncMock(return_value=conv)
        msgs = [make_fake_message(id="m1", content="Hi")]
        mock_messaging_repo.get_messages = AsyncMock(return_value=msgs)
        mock_messaging_repo.count_messages = AsyncMock(return_value=1)

        out = await messaging_service.get_messages("u-caller", "conv-1", skip=0, limit=20)

        assert out.total == 1
        assert len(out.messages) == 1
        assert out.messages[0].id == "m1"
        assert out.messages[0].content == "Hi"

    async def test_membership_only_checks_snake_case_user_id_key(
        self, messaging_service, mock_messaging_repo, patch_messaging_embed
    ):
        """``get_messages`` does not fall back to ``userId`` on members — only ``user_id``."""
        conv = make_fake_conv(members=[{"userId": "u-caller", "role": "member"}])
        mock_messaging_repo.get_conversation_by_id = AsyncMock(return_value=conv)

        with pytest.raises(ForbiddenException) as exc:
            await messaging_service.get_messages("u-caller", "conv-1")

        assert exc.value.error_code == "NOT_A_MEMBER"


@pytest.mark.asyncio
class TestSendMessage:
    async def test_conversation_not_found(
        self, messaging_service, mock_messaging_repo, patch_get_redis, patch_messaging_embed
    ):
        mock_messaging_repo.get_conversation_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await messaging_service.send_message(
                "u1", "c1", SendMessageRequest(content="x")
            )

    async def test_not_member_forbidden(
        self, messaging_service, mock_messaging_repo, patch_get_redis, patch_messaging_embed
    ):
        conv = make_fake_conv(participantIds=["other-only"])
        mock_messaging_repo.get_conversation_by_id = AsyncMock(return_value=conv)

        with pytest.raises(ForbiddenException) as exc:
            await messaging_service.send_message(
                "u-caller", "conv-1", SendMessageRequest(content="nope")
            )

        assert exc.value.error_code == "NOT_A_MEMBER"

    async def test_member_check_falls_back_to_json_members_camel_case(
        self, messaging_service, mock_messaging_repo, patch_get_redis, patch_messaging_embed, mock_redis
    ):
        conv = make_fake_conv(participantIds=None)
        conv.members = [{"userId": "u-caller", "role": "member"}, {"userId": "u-other", "role": "member"}]
        mock_messaging_repo.get_conversation_by_id = AsyncMock(return_value=conv)
        mock_messaging_repo.create_message = AsyncMock(return_value=make_fake_message(content="hey"))

        mock_pub = AsyncMock(return_value=0)
        with patch.object(mock_redis, "publish", mock_pub):
            await messaging_service.send_message(
                "u-caller", "conv-1", SendMessageRequest(content="hey", attachments=["a.png"])
            )

        mock_messaging_repo.create_message.assert_awaited_once()
        mock_pub.assert_awaited_once()
        envelope = json.loads(mock_pub.await_args[0][1])
        assert envelope["target_user_ids"] == ["u-other"]
        assert envelope["payload"]["type"] == "new_message"
        assert envelope["payload"]["data"]["content"] == "hey"

    async def test_publish_excludes_sender_from_targets(
        self, messaging_service, mock_messaging_repo, patch_get_redis, patch_messaging_embed, mock_redis
    ):
        conv = make_fake_conv(
            participantIds=["u-caller", "u-other", "u-third"],
        )
        mock_messaging_repo.get_conversation_by_id = AsyncMock(return_value=conv)
        mock_messaging_repo.create_message = AsyncMock(return_value=make_fake_message())

        mock_pub = AsyncMock(return_value=0)
        with patch.object(mock_redis, "publish", mock_pub):
            await messaging_service.send_message(
                "u-caller", "conv-1", SendMessageRequest(content="all")
            )

        envelope = json.loads(mock_pub.await_args[0][1])
        assert set(envelope["target_user_ids"]) == {"u-other", "u-third"}
