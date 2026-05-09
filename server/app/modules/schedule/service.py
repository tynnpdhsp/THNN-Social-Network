from app.modules.schedule.repository import ScheduleRepository
from app.modules.schedule.schema import (
    ScheduleCreate, ScheduleUpdate, ScheduleResponse, ScheduleListQuery, ScheduleListResponse,
    ScheduleEntryCreate, ScheduleEntryUpdate, ScheduleEntryResponse, ScheduleEntryListQuery, ScheduleEntryListResponse,
    CourseSectionCreate, CourseSectionResponse, CourseSectionUpdate, CourseSectionListResponse,
    StudyNoteCreate, StudyNoteUpdate, StudyNoteResponse, StudyNoteListQuery, StudyNoteListResponse
)
from app.core.exceptions import ConflictException, NotFoundException, ForbiddenException
from prisma.models import Schedule, ScheduleEntry, CourseSection, StudyNote, User # type: ignore

class ScheduleService:
    def __init__(self, repo: ScheduleRepository):
        self.repo = repo

    # region---- Schedule ----
    async def create_schedule(self, data: ScheduleCreate, user_id: str) -> ScheduleResponse:
        """Create a new schedule"""
        schedule_data = {
            "userId": user_id,
            "name": data.name,
            "source": data.source,
            "isActive": False
        }
        
        schedule = await self.repo.create_schedule(schedule_data)
        return self._map_schedule_to_response(schedule)
    
    async def get_schedules(self, query: ScheduleListQuery, user_id: str) -> ScheduleListResponse:
        """Get schedules with pagination and filtering"""
        schedules = await self.repo.get_schedules(
            skip=query.skip,
            limit=query.limit,
            is_active=query.is_active,
            user_id=user_id
        )
        
        total = await self.repo.count_schedules(
            is_active=query.is_active,
            user_id=user_id
        )
        
        items = [self._map_schedule_to_response(schedule) for schedule in schedules]
        
        return ScheduleListResponse(
            total=total,
            items=items,
            skip=query.skip,
            limit=query.limit
        )
    
    async def get_schedule_by_id(self, schedule_id: str, user_id: str) -> ScheduleResponse:
        """Get schedule by ID with ownership check"""
        schedule = await self.repo.get_schedule_by_id(schedule_id)
        if not schedule:
            raise NotFoundException("Schedule not found", "SCHEDULE_NOT_FOUND")
        
        if schedule.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        return self._map_schedule_to_response(schedule)
    
    async def update_schedule(self, schedule_id: str, data: ScheduleUpdate, user_id: str) -> ScheduleResponse:
        """Update schedule with ownership check"""
        schedule = await self.repo.get_schedule_by_id(schedule_id)
        if not schedule:
            raise NotFoundException("Schedule not found", "SCHEDULE_NOT_FOUND")
        
        if schedule.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        # Prepare update data
        update_data = {}
        if data.name is not None:
            update_data["name"] = data.name
        if data.is_active is not None:
            update_data["isActive"] = data.is_active
        
        if not update_data:
            raise ValueError("No fields to update")
        
        updated_schedule = await self.repo.update_schedule(schedule_id, update_data)
        return self._map_schedule_to_response(updated_schedule)
    
    async def delete_schedule(self, schedule_id: str, user_id: str) -> ScheduleResponse:
        """Delete schedule with ownership check"""
        schedule = await self.repo.get_schedule_by_id(schedule_id)
        if not schedule:
            raise NotFoundException("Schedule not found", "SCHEDULE_NOT_FOUND")
        
        if schedule.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        deleted_schedule = await self.repo.delete_schedule(schedule_id)
        return self._map_schedule_to_response(deleted_schedule)
    
    async def set_active_schedule(self, schedule_id: str, user_id: str) -> ScheduleResponse:
        """Set schedule as active"""
        schedule = await self.repo.get_schedule_by_id(schedule_id)
        if not schedule:
            raise NotFoundException("Schedule not found", "SCHEDULE_NOT_FOUND")
        
        if schedule.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        await self.repo.set_active_schedule(user_id, schedule_id)
        
        # Return the updated schedule
        updated_schedule = await self.repo.get_schedule_by_id(schedule_id)
        return self._map_schedule_to_response(updated_schedule)
    # endregion

    # region---- Schedule Entry ----
    async def create_schedule_entry(self, data: ScheduleEntryCreate, user_id: str) -> ScheduleEntryResponse:
        """Create a new schedule entry"""
        schedule = await self.repo.get_schedule_by_id(data.schedule_id)
        if not schedule:
            raise NotFoundException("Schedule not found", "SCHEDULE_NOT_FOUND")
        
        if schedule.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        if data.section_id:
            section = await self.repo.get_course_section_by_id(data.section_id)
            if section and section.userId != user_id or not section:
                raise ForbiddenException("Access denied to section", "ACCESS_DENIED")
        
        entry_data = {
            "scheduleId": data.schedule_id,
            "sectionId": data.section_id,
            "entryType": data.entry_type,
            "title": data.title,
            "dayOfWeek": data.day_of_week,
            "startTime": data.start_time,
            "endTime": data.end_time,
            "room": data.room,
            "date": data.date
        }
        
        entry = await self.repo.create_schedule_entry(entry_data)
        return self._map_schedule_entry_to_response(entry)
    
    async def get_schedule_entries(self, query: ScheduleEntryListQuery, user_id: str) -> ScheduleEntryListResponse:
        """Get schedule entries with pagination and filtering"""
        # If schedule_id is provided, verify ownership
        if query.schedule_id:
            schedule = await self.repo.get_schedule_by_id(query.schedule_id)
            if schedule and schedule.userId != user_id:
                raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        entries = await self.repo.get_schedule_entries(
            skip=query.skip,
            limit=query.limit,
            schedule_id=query.schedule_id,
            entry_type=query.entry_type,
            day_of_week=query.day_of_week
        )
        
        total = await self.repo.count_schedule_entries(
            schedule_id=query.schedule_id,
            entry_type=query.entry_type,
            day_of_week=query.day_of_week
        )
        
        items = [self._map_schedule_entry_to_response(entry) for entry in entries]
        
        return ScheduleEntryListResponse(
            total=total,
            items=items,
            skip=query.skip,
            limit=query.limit
        )
    
    async def get_schedule_entry_by_id(self, entry_id: str, user_id: str) -> ScheduleEntryResponse:
        """Get schedule entry by ID with ownership check"""
        entry = await self.repo.get_schedule_entry_by_id(entry_id)
        if not entry:
            raise NotFoundException("Schedule entry not found", "ENTRY_NOT_FOUND")
        
        # Check ownership through schedule
        if hasattr(entry, "schedule") and entry.schedule and entry.schedule.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        return self._map_schedule_entry_to_response(entry)
    
    async def update_schedule_entry(self, entry_id: str, data: ScheduleEntryUpdate, user_id: str) -> ScheduleEntryResponse:
        """Update schedule entry with ownership check"""
        entry = await self.repo.get_schedule_entry_by_id(entry_id)
        if not entry:
            raise NotFoundException("Schedule entry not found", "ENTRY_NOT_FOUND")
        
        # Check ownership through schedule
        if hasattr(entry, "schedule") and entry.schedule and entry.schedule.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        # Prepare update data
        update_data = {}
        if data.entry_type is not None:
            update_data["entryType"] = data.entry_type
        if data.title is not None:
            update_data["title"] = data.title
        if data.day_of_week is not None:
            update_data["dayOfWeek"] = data.day_of_week
        if data.start_time is not None:
            update_data["startTime"] = data.start_time
        if data.end_time is not None:
            update_data["endTime"] = data.end_time
        if data.room is not None:
            update_data["room"] = data.room
        if data.date is not None:
            update_data["date"] = data.date
        
        if not update_data:
            raise ValueError("No fields to update")
        
        updated_entry = await self.repo.update_schedule_entry(entry_id, update_data)
        return self._map_schedule_entry_to_response(updated_entry)
    
    async def delete_schedule_entry(self, entry_id: str, user_id: str) -> ScheduleEntryResponse:
        """Delete schedule entry with ownership check"""
        entry = await self.repo.get_schedule_entry_by_id(entry_id)
        if not entry:
            raise NotFoundException("Schedule entry not found", "ENTRY_NOT_FOUND")
        
        # Check ownership through schedule
        if hasattr(entry, "schedule") and entry.schedule and entry.schedule.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        deleted_entry = await self.repo.delete_schedule_entry(entry_id)
        return self._map_schedule_entry_to_response(deleted_entry)
    
    async def get_entries_by_schedule(self, schedule_id: str, user_id: str) -> list[ScheduleEntryResponse]:
        """Get all entries for a specific schedule"""
        schedule = await self.repo.get_schedule_by_id(schedule_id)
        if not schedule:
            raise NotFoundException("Schedule not found", "SCHEDULE_NOT_FOUND")
        
        if schedule.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        entries = await self.repo.get_entries_by_schedule(schedule_id)
        return [self._map_schedule_entry_to_response(entry) for entry in entries]
    # endregion

    # region---- Course Section ----
    async def create_course_section(self, data: CourseSectionCreate, user_id: str) -> CourseSectionResponse:
        """Create a new course section"""
        section_data = {
            "userId": user_id,
            "courseCode": data.course_code,
            "courseName": data.course_name,
            "sectionCode": data.section_code,
            "instructor": data.instructor,
            "dayOfWeek": data.day_of_week,
            "startTime": data.start_time,
            "endTime": data.end_time,
            "room": data.room,
            "semester": data.semester
        }
        
        section = await self.repo.create_course_section(section_data)
        return self._map_course_section_to_response(section)
    
    async def get_all_course_sections(self, user_id: str, skip: int, limit: int, semester: str = None) -> list[CourseSectionResponse]:
        """Get all course sections for a user"""
        sections = await self.repo.get_course_sections(skip, limit, user_id, semester)
        total = await self.repo.count_course_sections(user_id, semester)
        return CourseSectionListResponse(
            items=[self._map_course_section_to_response(section) for section in sections], 
            total=total, 
            skip=skip, 
            limit=limit
        )

    async def update_course_section(self, section_id: str, data: CourseSectionUpdate, user_id: str) -> CourseSectionResponse:
        """Update a course section"""
        section = await self.repo.get_course_section_by_id(section_id)
        if not section:
            raise NotFoundException("Course section not found", "COURSE_SECTION_NOT_FOUND")
        
        if section.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        update_data = {
            "courseCode": data.course_code,
            "courseName": data.course_name,
            "sectionCode": data.section_code,
            "instructor": data.instructor,
            "dayOfWeek": data.day_of_week,
            "startTime": data.start_time,
            "endTime": data.end_time,
            "room": data.room,
            "semester": data.semester
        }
        
        updated_section = await self.repo.update_course_section(section_id, update_data)
        return self._map_course_section_to_response(updated_section)

    async def delete_course_section(self, course_id: str, user_id: str) -> None:
        """Delete a course section"""
        course = await self.repo.get_course_section_by_id(course_id)

        if not course:
            raise NotFoundException("Course section not found", "COURSE_SECTION_NOT_FOUND")
        
        if course.userId != user_id:
            raise ForbiddenException("You don't have permission to delete this course section", "ACCESS_DENIED")

        result = await self.repo.delete_course_section(course_id)
        return self._map_course_section_to_response(result)

    # endregion

    # region---- Study Note ----
    async def create_study_note(self, data: StudyNoteCreate, user_id: str) -> StudyNoteResponse:
        """Create a new study note"""
        note_data = {
            "userId": user_id,
            "title": data.title,
            "subject": data.subject,
            "description": data.description,
            "dueAt": data.due_at,
            "noteType": data.note_type,
            "remindBeforeMinutes": data.remind_before_minutes,
            "isReminded": False
        }
        
        note = await self.repo.create_study_note(note_data)
        return self._map_study_note_to_response(note)
    
    async def get_study_notes(self, query: StudyNoteListQuery, user_id: str) -> StudyNoteListResponse:
        """Get study notes with pagination and filtering"""
        notes = await self.repo.get_study_notes(
            skip=query.skip,
            limit=query.limit,
            user_id=user_id,
            note_type=query.note_type,
            subject=query.subject
        )
        
        total = await self.repo.count_study_notes(
            user_id=user_id,
            note_type=query.note_type,
            subject=query.subject
        )
        
        items = [self._map_study_note_to_response(note) for note in notes]
        
        return StudyNoteListResponse(
            total=total,
            items=items,
            skip=query.skip,
            limit=query.limit
        )
    
    async def get_study_note_by_id(self, note_id: str, user_id: str) -> StudyNoteResponse:
        """Get study note by ID with ownership check"""
        note = await self.repo.get_study_note_by_id(note_id)
        if not note:
            raise NotFoundException("Study note not found", "NOTE_NOT_FOUND")
        
        if note.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        return self._map_study_note_to_response(note)
    
    async def update_study_note(self, note_id: str, data: StudyNoteUpdate, user_id: str) -> StudyNoteResponse:
        """Update study note with ownership check"""
        note = await self.repo.get_study_note_by_id(note_id)
        if not note:
            raise NotFoundException("Study note not found", "NOTE_NOT_FOUND")
        
        if note.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        # Prepare update data
        update_data = {}
        if data.title is not None:
            update_data["title"] = data.title
        if data.subject is not None:
            update_data["subject"] = data.subject
        if data.description is not None:
            update_data["description"] = data.description
        if data.due_at is not None:
            update_data["dueAt"] = data.due_at
        if data.note_type is not None:
            update_data["noteType"] = data.note_type
        if data.remind_before_minutes is not None:
            update_data["remindBeforeMinutes"] = data.remind_before_minutes
        
        if not update_data:
            raise ValueError("No fields to update")
        
        updated_note = await self.repo.update_study_note(note_id, update_data)
        return self._map_study_note_to_response(updated_note)
    
    async def delete_study_note(self, note_id: str, user_id: str) -> StudyNoteResponse:
        """Delete study note with ownership check"""
        note = await self.repo.get_study_note_by_id(note_id)
        if not note:
            raise NotFoundException("Study note not found", "NOTE_NOT_FOUND")
        
        if note.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        deleted_note = await self.repo.delete_study_note(note_id)
        return self._map_study_note_to_response(deleted_note)
    
    async def get_upcoming_notes(self, user_id: str, days: int = 7) -> list[StudyNoteResponse]:
        """Get upcoming study notes within specified days"""
        notes = await self.repo.get_upcoming_notes(user_id, days)
        return [self._map_study_note_to_response(note) for note in notes]
    
    async def get_overdue_notes(self, user_id: str) -> list[StudyNoteResponse]:
        """Get overdue study notes"""
        notes = await self.repo.get_overdue_notes(user_id)
        return [self._map_study_note_to_response(note) for note in notes]
    # endregion

    # region---- Helper Methods ----
    def _map_schedule_to_response(self, schedule: Schedule) -> ScheduleResponse:
        """Map Schedule model to ScheduleResponse"""
        return ScheduleResponse(
            id=schedule.id,
            user_id=schedule.userId,
            name=schedule.name,
            is_active=schedule.isActive,
            source=schedule.source,
            created_at=schedule.createdAt,
            updated_at=schedule.updatedAt
        )

    def _map_schedule_entry_to_response(self, entry: ScheduleEntry) -> ScheduleEntryResponse:
        """Map ScheduleEntry model to ScheduleEntryResponse"""
        return ScheduleEntryResponse(
            id=entry.id,
            schedule_id=entry.scheduleId,
            section_id=entry.sectionId,
            entry_type=entry.entryType,
            title=entry.title,
            day_of_week=entry.dayOfWeek,
            start_time=entry.startTime,
            end_time=entry.endTime,
            room=entry.room,
            date=entry.date,
            created_at=entry.createdAt
        )

    def _map_course_section_to_response(self, section: CourseSection) -> CourseSectionResponse:
        """Map CourseSection model to CourseSectionResponse"""
        return CourseSectionResponse(
            id=section.id,
            user_id=section.userId,
            course_code=section.courseCode,
            course_name=section.courseName,
            section_code=section.sectionCode,
            instructor=section.instructor,
            day_of_week=section.dayOfWeek,
            start_time=section.startTime,
            end_time=section.endTime,
            room=section.room,
            semester=section.semester,
            created_at=section.createdAt
        )

    def _map_study_note_to_response(self, note: StudyNote) -> StudyNoteResponse:
        """Map StudyNote model to StudyNoteResponse"""
        return StudyNoteResponse(
            id=note.id,
            user_id=note.userId,
            title=note.title,
            subject=note.subject,
            description=note.description,
            due_at=note.dueAt,
            note_type=note.noteType,
            remind_before_minutes=note.remindBeforeMinutes,
            is_reminded=note.isReminded,
            created_at=note.createdAt,
            updated_at=note.updatedAt
        )
    # endregion