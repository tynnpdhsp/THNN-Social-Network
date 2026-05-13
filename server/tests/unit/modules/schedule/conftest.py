"""Schedule module unit test helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture(autouse=True)
def fresh_schedule_repo_methods(mock_schedule_repo, mock_db):
    mock_schedule_repo.db = mock_db
    for name in (
        "create_schedule",
        "get_schedules",
        "count_schedules",
        "get_schedule_by_id",
        "update_schedule",
        "delete_schedule",
        "set_active_schedule",
        "create_schedule_entry",
        "get_schedule_entries",
        "count_schedule_entries",
        "get_schedule_entry_by_id",
        "update_schedule_entry",
        "delete_schedule_entry",
        "get_entries_by_schedule",
        "create_course_section",
        "get_course_sections",
        "count_course_sections",
        "get_course_section_by_id",
        "update_course_section",
        "delete_course_section",
        "create_study_note",
        "get_study_notes",
        "count_study_notes",
        "get_study_note_by_id",
        "update_study_note",
        "delete_study_note",
        "get_upcoming_notes",
        "get_overdue_notes",
        "mark_note_reminded",
    ):
        setattr(mock_schedule_repo, name, AsyncMock())
    mock_db.studynote.find_many = AsyncMock(return_value=[])
    yield


def make_schedule_row(
    sid="sch-1",
    uid="u-1",
    name="Lịch 1",
    is_active=False,
    source="manual",
):
    s = MagicMock()
    s.id = sid
    s.userId = uid
    s.name = name
    s.isActive = is_active
    s.source = source
    s.createdAt = datetime(2025, 1, 1, tzinfo=timezone.utc)
    s.updatedAt = datetime(2025, 1, 2, tzinfo=timezone.utc)
    return s


def make_schedule_mock_on_entry(schedule_user_id="u-1"):
    sch = MagicMock()
    sch.userId = schedule_user_id
    return sch


def make_schedule_entry_row(
    eid="ent-1",
    schedule_id="sch-1",
    schedule_user_id="u-1",
    section_id=None,
    **kwargs,
):
    defaults = dict(
        id=eid,
        scheduleId=schedule_id,
        sectionId=section_id,
        entryType="class",
        title="Toán",
        dayOfWeek=2,
        startTime="07:00",
        endTime="09:00",
        room="A1",
        date=None,
        createdAt=datetime(2025, 1, 3, tzinfo=timezone.utc),
    )
    e = MagicMock()
    for k, v in {**defaults, **kwargs}.items():
        setattr(e, k, v)
    e.schedule = make_schedule_mock_on_entry(schedule_user_id)
    return e


def make_course_section_row(sec_id="sec-1", uid="u-1", **kwargs):
    defaults = dict(
        id=sec_id,
        userId=uid,
        courseCode="CS101",
        courseName="Intro",
        sectionCode="01",
        instructor="Dr X",
        dayOfWeek=3,
        startTime="10:00",
        endTime="11:30",
        room="B2",
        semester="2025-1",
        createdAt=datetime(2025, 1, 4, tzinfo=timezone.utc),
    )
    s = MagicMock()
    for k, v in {**defaults, **kwargs}.items():
        setattr(s, k, v)
    return s


def make_study_note_row(nid="note-1", uid="u-1", **kwargs):
    defaults = dict(
        id=nid,
        userId=uid,
        title="Bài tập",
        subject="Math",
        description=None,
        dueAt=datetime(2025, 12, 31, 23, 0, tzinfo=timezone.utc),
        noteType="deadline",
        remindBeforeMinutes=60,
        isReminded=False,
        createdAt=datetime(2025, 1, 5, tzinfo=timezone.utc),
        updatedAt=datetime(2025, 1, 6, tzinfo=timezone.utc),
    )
    n = MagicMock()
    for k, v in {**defaults, **kwargs}.items():
        setattr(n, k, v)
    return n


@pytest.fixture()
def schedule_service_no_scheduler(mock_schedule_repo, notification_service):
    from app.modules.schedule.service import ScheduleService

    return ScheduleService(mock_schedule_repo, notification_service, scheduler=None)
