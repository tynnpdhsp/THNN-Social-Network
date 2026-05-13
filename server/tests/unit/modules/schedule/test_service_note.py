"""Study notes: reminders on create/update, CRUD."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException
from app.modules.schedule.schema import StudyNoteCreate, StudyNoteListQuery, StudyNoteUpdate

from .conftest import make_study_note_row


@pytest.mark.asyncio
class TestCreateStudyNote:
    async def test_remind_zero_does_not_schedule(self, schedule_service, mock_schedule_repo):
        note = make_study_note_row(remindBeforeMinutes=0)
        mock_schedule_repo.create_study_note = AsyncMock(return_value=note)
        spy = AsyncMock()
        schedule_service._schedule_note_reminder = spy

        await schedule_service.create_study_note(
            StudyNoteCreate(
                title="T",
                due_at=datetime(2030, 1, 1, 12, 0, tzinfo=timezone.utc),
                remind_before_minutes=0,
            ),
            "u1",
        )

        spy.assert_not_called()

    async def test_remind_positive_schedules(self, schedule_service, mock_schedule_repo):
        note = make_study_note_row(remindBeforeMinutes=30)
        mock_schedule_repo.create_study_note = AsyncMock(return_value=note)
        spy = AsyncMock()
        schedule_service._schedule_note_reminder = spy

        await schedule_service.create_study_note(
            StudyNoteCreate(
                title="T",
                due_at=datetime(2030, 1, 1, 12, 0, tzinfo=timezone.utc),
                remind_before_minutes=30,
            ),
            "u1",
        )

        spy.assert_awaited_once_with(
            note.id,
            "u1",
            note.title,
            note.dueAt,
            note.remindBeforeMinutes,
        )


@pytest.mark.asyncio
class TestGetStudyNotes:
    async def test_passes_filters(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_study_notes = AsyncMock(return_value=[])
        mock_schedule_repo.count_study_notes = AsyncMock(return_value=0)

        q = StudyNoteListQuery(skip=2, limit=10, note_type="exam", subject="Phy")
        await schedule_service.get_study_notes(q, "u1")

        mock_schedule_repo.get_study_notes.assert_awaited_once_with(
            skip=2, limit=10, user_id="u1", note_type="exam", subject="Phy"
        )


@pytest.mark.asyncio
class TestGetStudyNoteById:
    async def test_not_found(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_study_note_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await schedule_service.get_study_note_by_id("n1", "u1")
        assert exc.value.error_code == "NOTE_NOT_FOUND"

    async def test_not_owner(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_study_note_by_id = AsyncMock(
            return_value=make_study_note_row(uid="other")
        )

        with pytest.raises(ForbiddenException):
            await schedule_service.get_study_note_by_id("n1", "u1")


@pytest.mark.asyncio
class TestUpdateStudyNote:
    async def test_no_fields_value_error(self, schedule_service, mock_schedule_repo):
        n = make_study_note_row(uid="u1")
        mock_schedule_repo.get_study_note_by_id = AsyncMock(return_value=n)
        spy = AsyncMock()
        schedule_service._schedule_note_reminder = spy

        with pytest.raises(ValueError, match="No fields to update"):
            await schedule_service.update_study_note("n1", StudyNoteUpdate(), "u1")

        spy.assert_not_called()

    async def test_title_only_does_not_reschedule(self, schedule_service, mock_schedule_repo):
        n = make_study_note_row(uid="u1")
        mock_schedule_repo.get_study_note_by_id = AsyncMock(return_value=n)
        updated = make_study_note_row(uid="u1", title="New")
        mock_schedule_repo.update_study_note = AsyncMock(return_value=updated)
        spy = AsyncMock()
        schedule_service._schedule_note_reminder = spy

        await schedule_service.update_study_note(
            "n1", StudyNoteUpdate(title="New"), "u1"
        )

        spy.assert_not_called()

    async def test_due_at_change_reschedules(self, schedule_service, mock_schedule_repo):
        n = make_study_note_row(uid="u1")
        mock_schedule_repo.get_study_note_by_id = AsyncMock(return_value=n)
        new_due = datetime(2031, 6, 1, 10, 0, tzinfo=timezone.utc)
        updated = make_study_note_row(uid="u1", dueAt=new_due, remindBeforeMinutes=15)
        mock_schedule_repo.update_study_note = AsyncMock(return_value=updated)
        spy = AsyncMock()
        schedule_service._schedule_note_reminder = spy

        await schedule_service.update_study_note(
            "n1", StudyNoteUpdate(due_at=new_due), "u1"
        )

        spy.assert_awaited_once_with(
            updated.id, "u1", updated.title, updated.dueAt, updated.remindBeforeMinutes
        )

    async def test_remind_before_change_reschedules(self, schedule_service, mock_schedule_repo):
        n = make_study_note_row(uid="u1")
        mock_schedule_repo.get_study_note_by_id = AsyncMock(return_value=n)
        updated = make_study_note_row(uid="u1", remindBeforeMinutes=120)
        mock_schedule_repo.update_study_note = AsyncMock(return_value=updated)
        spy = AsyncMock()
        schedule_service._schedule_note_reminder = spy

        await schedule_service.update_study_note(
            "n1", StudyNoteUpdate(remind_before_minutes=120), "u1"
        )

        spy.assert_awaited_once()


@pytest.mark.asyncio
class TestDeleteStudyNote:
    async def test_not_owner(self, schedule_service, mock_schedule_repo):
        mock_schedule_repo.get_study_note_by_id = AsyncMock(
            return_value=make_study_note_row(uid="other")
        )

        with pytest.raises(ForbiddenException):
            await schedule_service.delete_study_note("n1", "u1")

    async def test_deletes(self, schedule_service, mock_schedule_repo):
        n = make_study_note_row(uid="u1")
        mock_schedule_repo.get_study_note_by_id = AsyncMock(return_value=n)
        mock_schedule_repo.delete_study_note = AsyncMock(return_value=n)

        out = await schedule_service.delete_study_note("n1", "u1")

        assert out.id == n.id


@pytest.mark.asyncio
class TestUpcomingOverdue:
    async def test_get_upcoming_delegates(self, schedule_service, mock_schedule_repo):
        n = make_study_note_row()
        mock_schedule_repo.get_upcoming_notes = AsyncMock(return_value=[n])

        out = await schedule_service.get_upcoming_notes("u1", days=14)

        assert len(out) == 1
        mock_schedule_repo.get_upcoming_notes.assert_awaited_once_with("u1", 14)

    async def test_get_overdue_delegates(self, schedule_service, mock_schedule_repo):
        n = make_study_note_row()
        mock_schedule_repo.get_overdue_notes = AsyncMock(return_value=[n])

        out = await schedule_service.get_overdue_notes("u1")

        assert len(out) == 1
        mock_schedule_repo.get_overdue_notes.assert_awaited_once_with("u1")
