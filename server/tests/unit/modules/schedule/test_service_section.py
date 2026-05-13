"""Course sections: bulk create, CRUD ownership."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException
from app.modules.schedule.schema import CourseSectionCreate, CourseSectionUpdate

from .conftest import make_course_section_row


@pytest.mark.asyncio
class TestCreateCourseSection:
    async def test_creates(self, schedule_service, mock_schedule_repo):
        sec = make_course_section_row()
        mock_schedule_repo.create_course_section = AsyncMock(return_value=sec)

        data = CourseSectionCreate(
            course_code="CS1",
            course_name="Algorithms",
            section_code="01",
            instructor="A",
            day_of_week=2,
            start_time="07:00",
            end_time="09:00",
            room="C1",
            semester="2025-1",
        )
        out = await schedule_service.create_course_section(data, "u1")

        assert out.course_code == "CS101"
        payload = mock_schedule_repo.create_course_section.await_args[0][0]
        assert payload["userId"] == "u1"


@pytest.mark.asyncio
class TestBulkCreateCourseSections:
    async def test_calls_create_per_row(self, schedule_service, mock_schedule_repo):
        s1 = make_course_section_row(sec_id="a")
        s2 = make_course_section_row(sec_id="b")
        mock_schedule_repo.create_course_section = AsyncMock(side_effect=[s1, s2])

        items = [
            CourseSectionCreate(
                course_code="A",
                course_name="A1",
                day_of_week=1,
                start_time="08:00",
                end_time="09:00",
            ),
            CourseSectionCreate(
                course_code="B",
                course_name="B1",
                day_of_week=2,
                start_time="10:00",
                end_time="11:00",
            ),
        ]
        out = await schedule_service.bulk_create_course_sections(items, "u1")

        assert len(out) == 2
        assert mock_schedule_repo.create_course_section.await_count == 2


@pytest.mark.asyncio
class TestGetAllCourseSections:
    async def test_returns_list_response(self, schedule_service, mock_schedule_repo):
        sec = make_course_section_row()
        mock_schedule_repo.get_course_sections = AsyncMock(return_value=[sec])
        mock_schedule_repo.count_course_sections = AsyncMock(return_value=5)

        out = await schedule_service.get_all_course_sections("u1", 0, 20, semester="2025-1")

        assert out.total == 5
        assert len(out.items) == 1
        mock_schedule_repo.get_course_sections.assert_awaited_once_with(
            0, 20, "u1", "2025-1"
        )


@pytest.mark.asyncio
class TestUpdateCourseSection:
    async def test_not_found(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_course_section_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await schedule_service.update_course_section(
                "x", CourseSectionUpdate(course_code="X"), "u1"
            )
        assert exc.value.error_code == "COURSE_SECTION_NOT_FOUND"

    async def test_not_owner(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_course_section_by_id = AsyncMock(
            return_value=make_course_section_row(uid="other")
        )

        with pytest.raises(ForbiddenException):
            await schedule_service.update_course_section(
                "sec-1", CourseSectionUpdate(course_code="X"), "u1"
            )

    async def test_updates(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_course_section_by_id = AsyncMock(
            return_value=make_course_section_row(uid="u1")
        )
        updated = make_course_section_row(courseName="NewName")
        mock_schedule_repo.update_course_section = AsyncMock(return_value=updated)

        out = await schedule_service.update_course_section(
            "sec-1",
            CourseSectionUpdate(course_name="NewName", course_code="CS1"),
            "u1",
        )

        assert out.course_name == "NewName"
        mock_schedule_repo.update_course_section.assert_awaited_once()


@pytest.mark.asyncio
class TestDeleteCourseSection:
    async def test_not_found(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_course_section_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await schedule_service.delete_course_section("x", "u1")

    async def test_not_owner(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_course_section_by_id = AsyncMock(
            return_value=make_course_section_row(uid="other")
        )

        with pytest.raises(ForbiddenException) as exc:
            await schedule_service.delete_course_section("sec-1", "u1")
        assert exc.value.error_code == "ACCESS_DENIED"

    async def test_deletes(self, schedule_service, mock_schedule_repo):
        sec = make_course_section_row(uid="u1")
        mock_schedule_repo.get_course_section_by_id = AsyncMock(return_value=sec)
        mock_schedule_repo.delete_course_section = AsyncMock(return_value=sec)

        out = await schedule_service.delete_course_section("sec-1", "u1")

        assert out.id == sec.id
        mock_schedule_repo.delete_course_section.assert_awaited_once_with("sec-1")
