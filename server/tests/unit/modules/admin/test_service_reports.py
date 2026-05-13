"""Reports list and ``resolve_report`` side effects."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from .conftest import make_report_row, make_resolved_report


@pytest.mark.asyncio
class TestGetReports:
    async def test_maps_repo_rows(self, admin_service, mock_admin_repo):
        rows = [
            {
                "id": "r1",
                "reporter_id": "u1",
                "reporter_name": "A",
                "target_type": "post",
                "target_id": "p1",
                "target_name": "Post",
                "target_preview": "prev",
                "reason": "x",
                "description": "d",
                "status": "pending",
                "created_at": datetime(2025, 1, 1, tzinfo=timezone.utc),
            }
        ]
        mock_admin_repo.get_reports = AsyncMock(return_value=(rows, 1))

        out = await admin_service.get_reports(skip=0, limit=20, status="pending")

        assert out.total == 1
        assert len(out.reports) == 1
        assert out.reports[0].id == "r1"
        assert out.reports[0].status == "pending"
        mock_admin_repo.get_reports.assert_awaited_once_with(0, 20, "pending")

    async def test_status_none_passed_through(
        self, admin_service, mock_admin_repo
    ):
        mock_admin_repo.get_reports = AsyncMock(return_value=([], 0))

        await admin_service.get_reports(skip=0, limit=10, status=None)

        mock_admin_repo.get_reports.assert_awaited_once_with(0, 10, None)


@pytest.mark.asyncio
class TestResolveReport:
    async def test_report_not_found(self, admin_service, mock_admin_repo, mock_db):
        mock_db.report.find_unique = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc:
            await admin_service.resolve_report("missing", "admin-1", "dismiss")

        assert exc.value.status_code == 404

    async def test_reporter_none_maps_unknown_name(
        self, admin_service, mock_admin_repo, mock_db
    ):
        r = make_report_row()
        r.reporter = None
        mock_db.report.find_unique = AsyncMock(return_value=r)
        resolved = make_resolved_report(resolved_action="dismiss")
        mock_admin_repo.resolve_report = AsyncMock(return_value=resolved)

        out = await admin_service.resolve_report("rep-1", "admin-1", "dismiss")

        assert out.reporter_name == "Unknown"

    async def test_dismiss_keeps_default_target_name_pattern(
        self, admin_service, mock_admin_repo, mock_db
    ):
        r = make_report_row(target_type="post", target_id="p-9")
        mock_db.report.find_unique = AsyncMock(return_value=r)
        resolved = make_resolved_report(
            rid="rep-1",
            target_type="post",
            target_id="p-9",
            resolved_action="dismiss",
        )
        mock_admin_repo.resolve_report = AsyncMock(return_value=resolved)

        out = await admin_service.resolve_report("rep-1", "admin-1", "dismiss")

        assert out.target_name == "post ID: p-9"
        mock_admin_repo.hide_post.assert_not_awaited()
        mock_admin_repo.hide_comment.assert_not_awaited()
        mock_admin_repo.lock_user.assert_not_awaited()

    async def test_hide_content_post_hides_and_sets_name(
        self, admin_service, mock_admin_repo, mock_db
    ):
        r = make_report_row(target_type="post", target_id="p-1")
        mock_db.report.find_unique = AsyncMock(return_value=r)
        resolved = make_resolved_report(
            target_type="post",
            target_id="p-1",
            resolved_action="hide_content",
        )
        mock_admin_repo.resolve_report = AsyncMock(return_value=resolved)
        mock_admin_repo.hide_post = AsyncMock(return_value=True)

        out = await admin_service.resolve_report("rep-1", "admin-1", "hide_content")

        mock_admin_repo.hide_post.assert_awaited_once_with("p-1")
        assert out.target_name == "Bài viết (Đã ẩn)"

    async def test_hide_content_comment_hides(
        self, admin_service, mock_admin_repo, mock_db
    ):
        r = make_report_row(target_type="comment", target_id="c-1")
        mock_db.report.find_unique = AsyncMock(return_value=r)
        resolved = make_resolved_report(
            target_type="comment",
            target_id="c-1",
            resolved_action="hide_content",
        )
        mock_admin_repo.resolve_report = AsyncMock(return_value=resolved)

        out = await admin_service.resolve_report("rep-1", "admin-1", "hide_content")

        mock_admin_repo.hide_comment.assert_awaited_once_with("c-1")
        assert out.target_name == "Bình luận (Đã ẩn)"

    async def test_lock_account_user_locks_target_id(
        self, admin_service, mock_admin_repo, mock_db
    ):
        r = make_report_row(target_type="user", target_id="bad-user")
        mock_db.report.find_unique = AsyncMock(return_value=r)
        resolved = make_resolved_report(
            target_type="user",
            target_id="bad-user",
            resolved_action="lock_account",
        )
        mock_admin_repo.resolve_report = AsyncMock(return_value=resolved)
        mock_admin_repo.lock_user = AsyncMock(return_value=MagicMock())

        out = await admin_service.resolve_report("rep-1", "admin-1", "lock_account")

        mock_admin_repo.lock_user.assert_awaited_once()
        call = mock_admin_repo.lock_user.await_args
        assert call[0][0] == "bad-user"
        assert "rep-1" in call[0][2]
        assert out.target_name == "Tài khoản (Đã khóa)"

    async def test_lock_account_post_locks_author(
        self, admin_service, mock_admin_repo, mock_db
    ):
        r = make_report_row(target_type="post", target_id="p-2")
        mock_db.report.find_unique = AsyncMock(return_value=r)
        resolved = make_resolved_report(
            target_type="post",
            target_id="p-2",
            resolved_action="lock_account",
        )
        mock_admin_repo.resolve_report = AsyncMock(return_value=resolved)
        post = MagicMock()
        post.userId = "author-77"
        mock_db.post.find_unique = AsyncMock(return_value=post)
        mock_admin_repo.lock_user = AsyncMock(return_value=MagicMock())

        out = await admin_service.resolve_report("rep-1", "admin-1", "lock_account")

        mock_admin_repo.lock_user.assert_awaited_once()
        call = mock_admin_repo.lock_user.await_args
        assert call.args[0] == "author-77"
        assert call.args[1] == "admin-1"
        assert "rep-1" in call.args[2]
        assert out.target_name == "Tài khoản (Đã khóa)"

    async def test_lock_account_post_missing_post_skips_lock(
        self, admin_service, mock_admin_repo, mock_db
    ):
        r = make_report_row(target_type="post", target_id="gone")
        mock_db.report.find_unique = AsyncMock(return_value=r)
        resolved = make_resolved_report(
            target_type="post",
            target_id="gone",
            resolved_action="lock_account",
        )
        mock_admin_repo.resolve_report = AsyncMock(return_value=resolved)
        mock_db.post.find_unique = AsyncMock(return_value=None)

        out = await admin_service.resolve_report("rep-1", "admin-1", "lock_account")

        mock_admin_repo.lock_user.assert_not_awaited()
        assert out.target_name == "post ID: gone"

    async def test_hide_content_user_does_not_call_hide_helpers(
        self, admin_service, mock_admin_repo, mock_db
    ):
        r = make_report_row(target_type="user", target_id="u-bad")
        mock_db.report.find_unique = AsyncMock(return_value=r)
        resolved = make_resolved_report(
            target_type="user",
            target_id="u-bad",
            resolved_action="hide_content",
        )
        mock_admin_repo.resolve_report = AsyncMock(return_value=resolved)

        out = await admin_service.resolve_report("rep-1", "admin-1", "hide_content")

        mock_admin_repo.hide_post.assert_not_awaited()
        mock_admin_repo.hide_comment.assert_not_awaited()
        assert out.target_name == "user ID: u-bad"