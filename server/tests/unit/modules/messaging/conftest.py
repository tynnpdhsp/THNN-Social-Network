"""Fixtures for messaging unit tests (inline ``db`` / ``get_account_repo``)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.account.repository import AccountRepository


@pytest.fixture(autouse=True)
def _messaging_unit_redis(patch_get_redis):
    """``ConnectionManager`` tracks online users and pub/sub via Redis."""
    yield patch_get_redis


@pytest.fixture()
def patch_messaging_embed(mock_messaging_repo):
    """Route ``MessagingService._get_user_embed`` Prisma access through ``mock_messaging_repo.db``."""
    db = mock_messaging_repo.db
    with patch("app.core.dependencies.db", db), patch(
        "app.core.dependencies.get_account_repo",
        lambda prisma_db=None: AccountRepository(db),
    ):
        yield db


@pytest.fixture(autouse=True)
def fresh_messaging_repo_methods(mock_messaging_repo):
    """Avoid AsyncMock call history / side_effect leaking between tests."""
    for name in (
        "get_user_conversations",
        "count_user_conversations",
        "get_conversation_by_id",
        "find_direct_conversation",
        "create_conversation",
        "get_messages",
        "count_messages",
        "create_message",
        "update_member_last_read",
    ):
        setattr(mock_messaging_repo, name, AsyncMock())
    yield


def make_fake_conv(**overrides) -> MagicMock:
    m = MagicMock()
    defaults = dict(
        id="conv-1",
        type="direct",
        name=None,
        members=[
            {"user_id": "u-caller", "role": "member"},
            {"user_id": "u-other", "role": "member"},
        ],
        lastMessage=None,
        updatedAt=datetime(2025, 6, 1, tzinfo=timezone.utc),
        participantIds=["u-caller", "u-other"],
    )
    for k, v in {**defaults, **overrides}.items():
        setattr(m, k, v)
    return m


def make_fake_message(**overrides) -> MagicMock:
    m = MagicMock()
    defaults = dict(
        id="msg-1",
        conversationId="conv-1",
        senderId="u-caller",
        content="Hello",
        attachments=[],
        createdAt=datetime(2025, 6, 2, tzinfo=timezone.utc),
    )
    for k, v in {**defaults, **overrides}.items():
        setattr(m, k, v)
    return m


def make_privacy(who_can_message: str = "everyone"):
    p = MagicMock()
    p.whoCanMessage = who_can_message
    p.userId = "u-other"
    return p


def make_user_row(uid="u-other", full_name="Other Person"):
    u = MagicMock()
    u.id = uid
    u.fullName = full_name
    u.avatarUrl = "https://cdn/x.png"
    return u
