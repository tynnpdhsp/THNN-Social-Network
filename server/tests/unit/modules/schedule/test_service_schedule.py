"""Schedule CRUD, ownership, set_active_schedule."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException
from app.modules.schedule.schema import ScheduleCreate, ScheduleListQuery, ScheduleUpdate

from .conftest import make_schedule_row


@pytest.mark.asyncio
class TestCreateSchedule:
    async def test_creates_inactive_manual(self, schedule_service, mock_schedule_repo):
        created = make_schedule_row(is_active=False)
        mock_schedule_repo.create_schedule = AsyncMock(return_value=created)

        out = await schedule_service.create_schedule(
            ScheduleCreate(name="HK1", source="manual"), "user-a"
        )

        mock_schedule_repo.create_schedule.assert_awaited_once()
        payload = mock_schedule_repo.create_schedule.await_args[0][0]
        assert payload["userId"] == "user-a"
        assert payload["name"] == "HK1"
        assert payload["isActive"] is False
        assert out.id == created.id


@pytest.mark.asyncio
class TestGetSchedules:
    async def test_lists_with_pagination(self, schedule_service, mock_schedule_repo):
        rows = [make_schedule_row(sid="a"), make_schedule_row(sid="b")]
        mock_schedule_repo.get_schedules = AsyncMock(return_value=rows)
        mock_schedule_repo.count_schedules = AsyncMock(return_value=10)

        q = ScheduleListQuery(skip=5, limit=10, is_active=True)
        out = await schedule_service.get_schedules(q, "user-a")

        assert out.total == 10
        assert len(out.items) == 2
        mock_schedule_repo.get_schedules.assert_awaited_once_with(
            skip=5, limit=10, is_active=True, user_id="user-a"
        )


@pytest.mark.asyncio
class TestGetScheduleById:
    async def test_not_found(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await schedule_service.get_schedule_by_id("x", "user-a")
        assert exc.value.error_code == "SCHEDULE_NOT_FOUND"

    async def test_wrong_user_forbidden(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="other")
        )

        with pytest.raises(ForbiddenException) as exc:
            await schedule_service.get_schedule_by_id("sch-1", "user-a")
        assert exc.value.error_code == "ACCESS_DENIED"

    async def test_owner_ok(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="user-a")
        )

        out = await schedule_service.get_schedule_by_id("sch-1", "user-a")

        assert out.user_id == "user-a"


@pytest.mark.asyncio
class TestUpdateSchedule:
    async def test_not_found(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await schedule_service.update_schedule(
                "x", ScheduleUpdate(name="N"), "user-a"
            )

    async def test_not_owner(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="other")
        )

        with pytest.raises(ForbiddenException):
            await schedule_service.update_schedule(
                "sch-1", ScheduleUpdate(name="N"), "user-a"
            )

    async def test_no_fields_value_error(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="user-a")
        )

        with pytest.raises(ValueError, match="No fields to update"):
            await schedule_service.update_schedule(
                "sch-1", ScheduleUpdate(), "user-a"
            )

    async def test_updates(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="user-a", name="Old")
        )
        updated = make_schedule_row(uid="user-a", name="New", is_active=True)
        mock_schedule_repo.update_schedule = AsyncMock(return_value=updated)

        out = await schedule_service.update_schedule(
            "sch-1", ScheduleUpdate(name="New", is_active=True), "user-a"
        )

        assert out.name == "New"
        assert out.is_active is True
        mock_schedule_repo.update_schedule.assert_awaited_once_with(
            "sch-1", {"name": "New", "isActive": True}
        )


@pytest.mark.asyncio
class TestDeleteSchedule:
    async def test_not_found(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await schedule_service.delete_schedule("x", "user-a")

    async def test_not_owner(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="other")
        )

        with pytest.raises(ForbiddenException):
            await schedule_service.delete_schedule("sch-1", "user-a")

    async def test_owner_deletes(self, schedule_service, mock_schedule_repo):
        deleted = make_schedule_row(uid="user-a")
        mock_schedule_repo.get_schedule_by_id = AsyncMock(return_value=deleted)
        mock_schedule_repo.delete_schedule = AsyncMock(return_value=deleted)

        await schedule_service.delete_schedule("sch-1", "user-a")

        mock_schedule_repo.delete_schedule.assert_awaited_once_with("sch-1")


@pytest.mark.asyncio
class TestSetActiveSchedule:
    async def test_not_found(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await schedule_service.set_active_schedule("x", "user-a")

    async def test_not_owner(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="other")
        )

        with pytest.raises(ForbiddenException):
            await schedule_service.set_active_schedule("sch-1", "user-a")

    async def test_sets_active_and_returns_refetched(
        self, schedule_service, mock_schedule_repo
    ):
        active_row = make_schedule_row(uid="user-a", is_active=True)
        mock_schedule_repo.get_schedule_by_id = AsyncMock(return_value=active_row)
        mock_schedule_repo.set_active_schedule = AsyncMock()

        out = await schedule_service.set_active_schedule("sch-1", "user-a")

        mock_schedule_repo.set_active_schedule.assert_awaited_once_with("user-a", "sch-1")
        assert out.is_active is True
