"""``_schedule_note_reminder`` and ``sync_reminders``."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from .conftest import make_study_note_row


@contextmanager
def patch_schedule_service_now(frozen: datetime):
    """Patch ``datetime`` binding in ``schedule.service`` (``from datetime import datetime``)."""
    mock_dt = MagicMock()
    mock_dt.now = MagicMock(return_value=frozen)
    with patch("app.modules.schedule.service.datetime", mock_dt):
        yield


@pytest.mark.asyncio
class TestScheduleNoteReminderGuards:
    async def test_no_scheduler_returns_immediately(self, schedule_service_no_scheduler):
        await schedule_service_no_scheduler._schedule_note_reminder(
            "n1",
            "u1",
            "Title",
            datetime(2030, 1, 1, tzinfo=timezone.utc),
            60,
        )

    async def test_no_due_at_returns(self, schedule_service, mock_scheduler):
        await schedule_service._schedule_note_reminder("n1", "u1", "T", None, 60)

        mock_scheduler.add_job.assert_not_called()

    async def test_remind_before_none_returns(self, schedule_service, mock_scheduler):
        due = datetime(2030, 1, 1, 12, 0, tzinfo=timezone.utc)
        await schedule_service._schedule_note_reminder("n1", "u1", "T", due, None)

        mock_scheduler.add_job.assert_not_called()


@pytest.mark.asyncio
class TestScheduleNoteReminderJobs:
    async def test_future_reminder_schedules_at_remind_time(
        self, schedule_service, mock_scheduler
    ):
        now = datetime(2025, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
        due = datetime(2025, 6, 1, 15, 0, 0, tzinfo=timezone.utc)
        mock_scheduler.get_job.return_value = None

        with patch_schedule_service_now(now):
            await schedule_service._schedule_note_reminder("n1", "u1", "T", due, 60)

        mock_scheduler.add_job.assert_called_once()
        kwargs = mock_scheduler.add_job.call_args[1]
        assert kwargs["run_date"] == due - timedelta(minutes=60)
        assert kwargs["id"] == "note_reminder_n1"

    async def test_immediate_when_remind_time_passed_but_before_deadline(
        self, schedule_service, mock_scheduler
    ):
        now = datetime(2025, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
        due = datetime(2025, 6, 1, 13, 0, 0, tzinfo=timezone.utc)
        mock_scheduler.get_job.return_value = None

        with patch_schedule_service_now(now):
            await schedule_service._schedule_note_reminder("n1", "u1", "T", due, 120)

        kwargs = mock_scheduler.add_job.call_args[1]
        assert kwargs["run_date"] == now

    async def test_past_deadline_no_job_scheduled(
        self, schedule_service, mock_scheduler
    ):
        now = datetime(2025, 6, 1, 15, 0, 0, tzinfo=timezone.utc)
        due = datetime(2025, 6, 1, 14, 0, 0, tzinfo=timezone.utc)
        mock_scheduler.get_job.return_value = None

        with patch_schedule_service_now(now):
            await schedule_service._schedule_note_reminder("n1", "u1", "T", due, 60)

        mock_scheduler.add_job.assert_not_called()

    async def test_removes_existing_job_before_add(
        self, schedule_service, mock_scheduler
    ):
        now = datetime(2025, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
        due = datetime(2025, 6, 1, 20, 0, 0, tzinfo=timezone.utc)
        mock_scheduler.get_job.return_value = MagicMock()

        with patch_schedule_service_now(now):
            await schedule_service._schedule_note_reminder("n1", "u1", "T", due, 30)

        mock_scheduler.remove_job.assert_called_once_with("note_reminder_n1")
        mock_scheduler.add_job.assert_called_once()

    async def test_naive_due_at_gets_utc_assumed(self, schedule_service, mock_scheduler):
        now = datetime(2025, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
        due_naive = datetime(2025, 6, 1, 15, 0, 0)
        mock_scheduler.get_job.return_value = None

        with patch_schedule_service_now(now):
            await schedule_service._schedule_note_reminder("n1", "u1", "T", due_naive, 60)

        kwargs = mock_scheduler.add_job.call_args[1]
        expected_due = due_naive.replace(tzinfo=timezone.utc)
        assert kwargs["run_date"] == expected_due - timedelta(minutes=60)


@pytest.mark.asyncio
class TestSyncReminders:
    async def test_no_scheduler_returns_early(
        self, schedule_service_no_scheduler, mock_schedule_repo
    ):
        mock_schedule_repo.db.studynote.find_many = AsyncMock(
            return_value=[make_study_note_row(remindBeforeMinutes=60)]
        )

        await schedule_service_no_scheduler.sync_reminders()

        mock_schedule_repo.db.studynote.find_many.assert_not_called()

    async def test_only_notes_with_positive_reminder_scheduled(
        self, schedule_service, mock_schedule_repo, mock_scheduler
    ):
        n_on = make_study_note_row(nid="a", remindBeforeMinutes=30)
        n_off = make_study_note_row(nid="b", remindBeforeMinutes=0)
        mock_schedule_repo.db.studynote.find_many = AsyncMock(return_value=[n_on, n_off])
        spy = AsyncMock()
        schedule_service._schedule_note_reminder = spy
        mock_scheduler.get_job.return_value = None

        with patch_schedule_service_now(datetime(2025, 1, 1, tzinfo=timezone.utc)):
            await schedule_service.sync_reminders()

        assert spy.await_count == 1
        first = spy.await_args[0]
        assert first[0] == "a"

    async def test_query_filters_future_unreminded_not_deleted(
        self, schedule_service, mock_schedule_repo, mock_scheduler
    ):
        mock_schedule_repo.db.studynote.find_many = AsyncMock(return_value=[])
        mock_scheduler.get_job.return_value = None

        frozen = datetime(2025, 7, 1, 10, 0, tzinfo=timezone.utc)
        with patch_schedule_service_now(frozen):
            await schedule_service.sync_reminders()

        mock_schedule_repo.db.studynote.find_many.assert_awaited_once()
        where = mock_schedule_repo.db.studynote.find_many.await_args.kwargs["where"]
        assert where["dueAt"] == {"gt": frozen}
        assert where["isReminded"] is False
        assert where["deletedAt"] is None
