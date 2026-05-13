"""Helpers and per-test repo wiring for notification unit tests."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest


def make_notification_row(**kwargs) -> MagicMock:
    """Prisma-like row for ``NotificationService._map_to_response`` / ``repo.create`` return."""
    m = MagicMock()
    defaults = dict(
        id="notif-1",
        userId="user-1",
        type="like",
        title="T",
        content="C",
        metadata=None,
        isRead=False,
        createdAt=datetime(2025, 6, 1, 12, 0, 0, tzinfo=timezone.utc),
    )
    defaults.update(kwargs)
    for k, v in defaults.items():
        setattr(m, k, v)
    return m


@pytest.fixture(autouse=True)
def fresh_notification_repo_mocks(mock_notification_repo):
    """Isolate each test from others' ``AsyncMock`` side_effects on the shared repo."""
    for name in (
        "get_by_user",
        "count_by_user",
        "count_unread",
        "create",
        "get_by_id",
        "mark_many_as_read",
        "mark_all_as_read",
        "delete_notification",
        "delete_all_by_user",
    ):
        setattr(mock_notification_repo, name, AsyncMock())
    mock_notification_repo.create.return_value = make_notification_row()
    yield
