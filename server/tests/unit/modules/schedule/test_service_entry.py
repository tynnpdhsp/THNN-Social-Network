"""Schedule entries: CRUD, section ownership, list ownership filter."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException
from app.modules.schedule.schema import (
    ScheduleEntryCreate,
    ScheduleEntryListQuery,
    ScheduleEntryUpdate,
)

from .conftest import make_course_section_row, make_schedule_entry_row, make_schedule_row


@pytest.mark.asyncio
class TestCreateScheduleEntry:
    async def test_schedule_not_found(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await schedule_service.create_schedule_entry(
                ScheduleEntryCreate(
                    schedule_id="sch-1",
                    entry_type="class",
                    title="L",
                    start_time="08:00",
                    end_time="09:00",
                ),
                "u1",
            )
        assert exc.value.error_code == "SCHEDULE_NOT_FOUND"

    async def test_schedule_not_owner(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="other")
        )

        with pytest.raises(ForbiddenException):
            await schedule_service.create_schedule_entry(
                ScheduleEntryCreate(
                    schedule_id="sch-1",
                    entry_type="class",
                    title="L",
                    start_time="08:00",
                    end_time="09:00",
                ),
                "u1",
            )

    async def test_section_not_found_forbidden(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="u1")
        )
        mock_schedule_repo.get_course_section_by_id = AsyncMock(return_value=None)

        with pytest.raises(ForbiddenException) as exc:
            await schedule_service.create_schedule_entry(
                ScheduleEntryCreate(
                    schedule_id="sch-1",
                    section_id="missing-sec",
                    entry_type="class",
                    title="L",
                    start_time="08:00",
                    end_time="09:00",
                ),
                "u1",
            )
        assert exc.value.error_code == "ACCESS_DENIED"

    async def test_section_other_user_forbidden(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="u1")
        )
        mock_schedule_repo.get_course_section_by_id = AsyncMock(
            return_value=make_course_section_row(uid="other")
        )

        with pytest.raises(ForbiddenException):
            await schedule_service.create_schedule_entry(
                ScheduleEntryCreate(
                    schedule_id="sch-1",
                    section_id="sec-1",
                    entry_type="class",
                    title="L",
                    start_time="08:00",
                    end_time="09:00",
                ),
                "u1",
            )

    async def test_section_owner_ok(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="u1")
        )
        mock_schedule_repo.get_course_section_by_id = AsyncMock(
            return_value=make_course_section_row(uid="u1")
        )
        ent = make_schedule_entry_row()
        mock_schedule_repo.create_schedule_entry = AsyncMock(return_value=ent)

        await schedule_service.create_schedule_entry(
            ScheduleEntryCreate(
                schedule_id="sch-1",
                section_id="sec-1",
                entry_type="class",
                title="L",
                start_time="08:00",
                end_time="09:00",
            ),
            "u1",
        )

        data = mock_schedule_repo.create_schedule_entry.await_args[0][0]
        assert data["sectionId"] == "sec-1"


@pytest.mark.asyncio
class TestGetScheduleEntries:
    async def test_forbidden_when_filtering_other_users_schedule(
        self, schedule_service, mock_schedule_repo
    ):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="other")
        )

        with pytest.raises(ForbiddenException):
            await schedule_service.get_schedule_entries(
                ScheduleEntryListQuery(schedule_id="sch-1"), "u1"
            )

    async def test_owner_can_list_with_schedule_filter(
        self, schedule_service, mock_schedule_repo
    ):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="u1")
        )
        mock_schedule_repo.get_schedule_entries = AsyncMock(return_value=[])
        mock_schedule_repo.count_schedule_entries = AsyncMock(return_value=0)

        await schedule_service.get_schedule_entries(
            ScheduleEntryListQuery(schedule_id="sch-1", skip=0, limit=20), "u1"
        )

        mock_schedule_repo.get_schedule_entries.assert_awaited_once_with(
            skip=0, limit=20, schedule_id="sch-1", entry_type=None, day_of_week=None
        )

    async def test_missing_schedule_id_skips_ownership_check(
        self, schedule_service, mock_schedule_repo
    ):
        """If ``schedule_id`` is absent, service does not verify schedule owner."""
        mock_schedule_repo.get_schedule_entries = AsyncMock(return_value=[])
        mock_schedule_repo.count_schedule_entries = AsyncMock(return_value=0)

        await schedule_service.get_schedule_entries(ScheduleEntryListQuery(), "u1")

        mock_schedule_repo.get_schedule_by_id.assert_not_called()

    async def test_schedule_id_but_schedule_missing_no_forbidden(
        self, schedule_service, mock_schedule_repo
    ):
        """``schedule`` is None: condition ``schedule and schedule.userId != user_id`` is false."""
        mock_schedule_repo.get_schedule_by_id = AsyncMock(return_value=None)
        mock_schedule_repo.get_schedule_entries = AsyncMock(return_value=[])
        mock_schedule_repo.count_schedule_entries = AsyncMock(return_value=0)

        await schedule_service.get_schedule_entries(
            ScheduleEntryListQuery(schedule_id="ghost"), "u1"
        )

        mock_schedule_repo.get_schedule_entries.assert_awaited_once()


@pytest.mark.asyncio
class TestGetScheduleEntryById:
    async def test_not_found(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_entry_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await schedule_service.get_schedule_entry_by_id("e1", "u1")
        assert exc.value.error_code == "ENTRY_NOT_FOUND"

    async def test_not_owner_via_schedule(self, schedule_service, mock_schedule_repo):
        ent = make_schedule_entry_row(schedule_user_id="other")
        mock_schedule_repo.get_schedule_entry_by_id = AsyncMock(return_value=ent)

        with pytest.raises(ForbiddenException):
            await schedule_service.get_schedule_entry_by_id("e1", "u1")

    async def test_entry_without_schedule_passes_ownership_check(
        self, schedule_service, mock_schedule_repo
    ):
        ent = make_schedule_entry_row()
        ent.schedule = None
        mock_schedule_repo.get_schedule_entry_by_id = AsyncMock(return_value=ent)

        out = await schedule_service.get_schedule_entry_by_id("e1", "u1")

        assert out.id == ent.id


@pytest.mark.asyncio
class TestUpdateDeleteScheduleEntry:
    async def test_update_no_fields_value_error(self, schedule_service, mock_schedule_repo):
        ent = make_schedule_entry_row(schedule_user_id="u1")
        mock_schedule_repo.get_schedule_entry_by_id = AsyncMock(return_value=ent)

        with pytest.raises(ValueError, match="No fields to update"):
            await schedule_service.update_schedule_entry("e1", ScheduleEntryUpdate(), "u1")

    async def test_update_not_owner(self, schedule_service, mock_schedule_repo):
        ent = make_schedule_entry_row(schedule_user_id="other")
        mock_schedule_repo.get_schedule_entry_by_id = AsyncMock(return_value=ent)

        with pytest.raises(ForbiddenException):
            await schedule_service.update_schedule_entry(
                "e1", ScheduleEntryUpdate(title="X"), "u1"
            )

    async def test_update_ok(self, schedule_service, mock_schedule_repo):
        ent = make_schedule_entry_row(schedule_user_id="u1")
        mock_schedule_repo.get_schedule_entry_by_id = AsyncMock(return_value=ent)
        updated = make_schedule_entry_row(title="New")
        mock_schedule_repo.update_schedule_entry = AsyncMock(return_value=updated)

        out = await schedule_service.update_schedule_entry(
            "e1", ScheduleEntryUpdate(title="New"), "u1"
        )

        assert out.title == "New"

    async def test_delete_not_owner(self, schedule_service, mock_schedule_repo):
        ent = make_schedule_entry_row(schedule_user_id="other")
        mock_schedule_repo.get_schedule_entry_by_id = AsyncMock(return_value=ent)

        with pytest.raises(ForbiddenException):
            await schedule_service.delete_schedule_entry("e1", "u1")

    async def test_delete_ok(self, schedule_service, mock_schedule_repo):
        ent = make_schedule_entry_row(schedule_user_id="u1")
        mock_schedule_repo.get_schedule_entry_by_id = AsyncMock(return_value=ent)
        mock_schedule_repo.delete_schedule_entry = AsyncMock(return_value=ent)

        await schedule_service.delete_schedule_entry("e1", "u1")

        mock_schedule_repo.delete_schedule_entry.assert_awaited_once_with("e1")


@pytest.mark.asyncio
class TestGetEntriesBySchedule:
    async def test_schedule_not_found(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await schedule_service.get_entries_by_schedule("sch-1", "u1")

    async def test_not_owner(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="other")
        )

        with pytest.raises(ForbiddenException):
            await schedule_service.get_entries_by_schedule("sch-1", "u1")

    async def test_returns_mapped_entries(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_schedule_by_id = AsyncMock(
            return_value=make_schedule_row(uid="u1")
        )
        ent = make_schedule_entry_row()
        mock_schedule_repo.get_entries_by_schedule = AsyncMock(return_value=[ent])

        out = await schedule_service.get_entries_by_schedule("sch-1", "u1")

        assert len(out) == 1
        assert out[0].id == ent.id
