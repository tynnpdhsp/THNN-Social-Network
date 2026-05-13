"""User listing, lock/unlock, role update."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from .conftest import make_admin_user


@pytest.mark.asyncio
class TestGetUsers:
    async def test_pagination_and_role_mapping(
        self, admin_service, mock_admin_repo, mock_db
    ):
        u1 = make_admin_user(uid="a", role_name="admin")
        u2 = make_admin_user(uid="b", role_name="student")
        mock_admin_repo.get_users = AsyncMock(return_value=[u1, u2])
        mock_admin_repo.count_users = AsyncMock(return_value=50)

        out = await admin_service.get_users(skip=5, limit=10, is_locked=True)

        mock_admin_repo.get_users.assert_awaited_once_with(5, 10, True)
        mock_admin_repo.count_users.assert_awaited_once_with(True)
        assert out.total == 50
        assert out.skip == 5
        assert out.limit == 10
        assert len(out.users) == 2
        assert out.users[0].role == "admin"
        assert out.users[1].role == "student"

    async def test_role_unknown_when_no_role_ref(self, admin_service, mock_admin_repo):
        u = make_admin_user()
        u.roleRef = None
        mock_admin_repo.get_users = AsyncMock(return_value=[u])
        mock_admin_repo.count_users = AsyncMock(return_value=1)

        out = await admin_service.get_users(0, 20, None)

        assert out.users[0].role == "unknown"


@pytest.mark.asyncio
class TestLockUser:
    async def test_not_found_raises_404(self, admin_service, mock_admin_repo):
        mock_admin_repo.lock_user = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc:
            await admin_service.lock_user("missing", "admin-1", "reason")

        assert exc.value.status_code == 404

    async def test_success_locks_and_reloads_with_role(
        self, admin_service, mock_admin_repo, mock_db
    ):
        mock_admin_repo.lock_user = AsyncMock(return_value=MagicMock())
        reloaded = make_admin_user(uid="u-99", role_name="student", locked=True)
        mock_db.user.find_unique = AsyncMock(return_value=reloaded)

        out = await admin_service.lock_user("u-99", "admin-1", "spam")

        mock_admin_repo.lock_user.assert_awaited_once_with("u-99", "admin-1", "spam")
        mock_db.user.find_unique.assert_awaited()
        assert out.id == "u-99"
        assert out.is_locked is True
        assert out.role == "student"


@pytest.mark.asyncio
class TestUnlockUser:
    async def test_not_found_raises_404(self, admin_service, mock_admin_repo):
        mock_admin_repo.unlock_user = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc:
            await admin_service.unlock_user("missing")

        assert exc.value.status_code == 404

    async def test_success_defaults_role_student_when_no_role_ref(
        self, admin_service, mock_admin_repo, mock_db
    ):
        mock_admin_repo.unlock_user = AsyncMock(return_value=MagicMock())
        u = make_admin_user(locked=False)
        u.roleRef = None
        mock_db.user.find_unique = AsyncMock(return_value=u)

        out = await admin_service.unlock_user("u-1")

        assert out.role == "student"


@pytest.mark.asyncio
class TestUpdateUserRole:
    async def test_role_not_found_raises_404(self, admin_service, mock_db):
        mock_db.role.find_first = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc:
            await admin_service.update_user_role("u-1", "nonexistent")

        assert exc.value.status_code == 404
        assert "Role" in exc.value.detail

    async def test_user_not_found_after_update_raises_404(
        self, admin_service, mock_admin_repo, mock_db
    ):
        role = MagicMock()
        role.id = "role-new"
        role.role = "admin"
        mock_db.role.find_first = AsyncMock(return_value=role)
        mock_admin_repo.update_user_role = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc:
            await admin_service.update_user_role("ghost", "admin")

        assert exc.value.status_code == 404
        assert "User" in exc.value.detail

    async def test_success_updates_and_reloads(
        self, admin_service, mock_admin_repo, mock_db
    ):
        role = MagicMock()
        role.id = "role-admin-id"
        role.role = "admin"
        mock_db.role.find_first = AsyncMock(return_value=role)
        mock_admin_repo.update_user_role = AsyncMock(return_value=MagicMock())
        updated = make_admin_user(uid="u-1", role_name="admin")
        mock_db.user.find_unique = AsyncMock(return_value=updated)

        out = await admin_service.update_user_role("u-1", "admin")

        mock_admin_repo.update_user_role.assert_awaited_once_with("u-1", "role-admin-id")
        assert out.role == "admin"
