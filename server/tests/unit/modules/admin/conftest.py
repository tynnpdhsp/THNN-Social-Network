"""Admin unit test helpers and isolated repo mocks."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture(autouse=True)
def _admin_unit_redis(patch_get_redis):
    """Admin lock/report flows call ``notify_user_locked`` (Redis pub/sub)."""
    yield patch_get_redis


@pytest.fixture(autouse=True)
def fresh_admin_repo_methods(mock_admin_repo):
    for name in (
        "get_overview_stats",
        "get_users",
        "count_users",
        "lock_user",
        "unlock_user",
        "get_reports",
        "resolve_report",
        "hide_post",
        "hide_comment",
        "update_user_role",
        "get_audit_logs",
        "count_audit_logs",
    ):
        setattr(mock_admin_repo, name, AsyncMock())
    yield


def make_admin_user(
    uid="u-1",
    email="a@b.com",
    full_name="User One",
    role_name="student",
    locked=False,
    last_login=None,
):
    u = MagicMock()
    u.id = uid
    u.email = email
    u.fullName = full_name
    u.isLocked = locked
    u.createdAt = datetime(2025, 1, 1, tzinfo=timezone.utc)
    u.lastLoginAt = last_login
    u.avatarUrl = None
    rr = MagicMock()
    rr.role = role_name
    u.roleRef = rr
    return u


def make_report_row(
    rid="rep-1",
    reporter_id="rep-user",
    target_type="post",
    target_id="post-1",
    status="pending",
    reason="spam",
    description="bad",
):
    r = MagicMock()
    r.id = rid
    r.reporterId = reporter_id
    r.targetType = target_type
    r.targetId = target_id
    r.reason = reason
    r.description = description
    r.status = status
    r.createdAt = datetime(2025, 2, 1, tzinfo=timezone.utc)
    r.resolvedAt = None
    r.resolvedBy = None
    r.resolvedAction = None
    rep = MagicMock()
    rep.fullName = "Reporter Name"
    r.reporter = rep
    return r


def make_resolved_report(resolved_action="hide_content", **kwargs):
    r = make_report_row(**kwargs)
    r.status = "resolved"
    r.resolvedAt = datetime(2025, 2, 2, tzinfo=timezone.utc)
    r.resolvedBy = "admin-1"
    r.resolvedAction = resolved_action
    return r


def make_audit_row(lid="log-1", user_id="u-x", action="LOGIN", severity="info"):
    l = MagicMock()
    l.id = lid
    l.userId = user_id
    l.action = action
    l.severity = severity
    l.createdAt = datetime(2025, 3, 1, tzinfo=timezone.utc)
    l.payload = {"ip": "127.0.0.1"}
    return l
