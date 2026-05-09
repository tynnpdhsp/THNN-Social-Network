from prisma import Prisma
from prisma.models import Schedule, ScheduleEntry, CourseSection, StudyNote, User # type: ignore
from app.modules.schedule.schema import (
    CourseSectionListResponse, ScheduleCreate, ScheduleEntryCreate, CourseSectionCreate, StudyNoteCreate
)
from datetime import datetime

class ScheduleRepository:
    def __init__(self, db: Prisma):
        self.db = db

    # region--- Schedule -----
    async def create_schedule(self, data: dict) -> Schedule:
        return await self.db.schedule.create(data=data)
    
    async def get_schedules(self, skip: int, limit: int, is_active: bool = None, user_id: str = None) -> list[Schedule]:
        """Get schedules with filtering"""
        where_conditions = {}
        
        if user_id:
            where_conditions["userId"] = user_id
        
        if is_active is not None:
            where_conditions["isActive"] = is_active
        
        return await self.db.schedule.find_many(
            where=where_conditions,
            skip=skip,
            take=limit,
            order={"createdAt": "desc"}
        )
    
    async def count_schedules(self, is_active: bool = None, user_id: str = None) -> int:
        """Count schedules with filtering"""
        where_conditions = {}
        
        if user_id:
            where_conditions["userId"] = user_id
        
        if is_active is not None:
            where_conditions["isActive"] = is_active
        
        return await self.db.schedule.count(where=where_conditions)
    
    async def get_schedule_by_id(self, schedule_id: str) -> Schedule:
        """Get schedule by ID"""
        return await self.db.schedule.find_unique(where={"id": schedule_id})
    
    async def update_schedule(self, schedule_id: str, data: dict) -> Schedule:
        """Update schedule by ID"""
        return await self.db.schedule.update(
            where={"id": schedule_id},
            data=data
        )
    
    async def delete_schedule(self, schedule_id: str) -> Schedule:
        """Delete schedule by ID"""
        return await self.db.schedule.delete(where={"id": schedule_id})
    
    async def set_active_schedule(self, user_id: str, schedule_id: str) -> None:
        """Set a schedule as active and deactivate others"""
        async with self.db.tx() as tx:
            # Deactivate all user's schedules
            await tx.schedule.update_many(
                where={"userId": user_id},
                data={"isActive": False}
            )
            
            # Activate the specified schedule
            await tx.schedule.update(
                where={"id": schedule_id},
                data={"isActive": True}
            )
    # endregion

    # region--- Schedule Entry -----
    async def create_schedule_entry(self, data: dict) -> ScheduleEntry:
        return await self.db.scheduleentry.create(data=data)
    
    async def get_schedule_entries(self, skip: int, limit: int, schedule_id: str = None, 
                                 entry_type: str = None, day_of_week: int = None) -> list[ScheduleEntry]:
        """Get schedule entries with filtering"""
        where_conditions = {}
        
        if schedule_id:
            where_conditions["scheduleId"] = schedule_id
        
        if entry_type:
            where_conditions["entryType"] = entry_type
        
        if day_of_week:
            where_conditions["dayOfWeek"] = day_of_week
        
        return await self.db.scheduleentry.find_many(
            where=where_conditions,
            include={"schedule": True, "section": True},
            skip=skip,
            take=limit,
            order={"createdAt": "desc"}
        )
    
    async def count_schedule_entries(self, schedule_id: str = None, 
                                   entry_type: str = None, day_of_week: int = None) -> int:
        """Count schedule entries with filtering"""
        where_conditions = {}
        
        if schedule_id:
            where_conditions["scheduleId"] = schedule_id
        
        if entry_type:
            where_conditions["entryType"] = entry_type
        
        if day_of_week:
            where_conditions["dayOfWeek"] = day_of_week
        
        return await self.db.scheduleentry.count(where=where_conditions)
    
    async def get_schedule_entry_by_id(self, entry_id: str) -> ScheduleEntry:
        """Get schedule entry by ID"""
        return await self.db.scheduleentry.find_unique(
            where={"id": entry_id},
            include={"schedule": True, "section": True}
        )
    
    async def update_schedule_entry(self, entry_id: str, data: dict) -> ScheduleEntry:
        """Update schedule entry by ID"""
        return await self.db.scheduleentry.update(
            where={"id": entry_id},
            data=data
        )
    
    async def delete_schedule_entry(self, entry_id: str) -> ScheduleEntry:
        """Delete schedule entry by ID"""
        return await self.db.scheduleentry.delete(where={"id": entry_id})
    
    async def get_entries_by_schedule(self, schedule_id: str) -> list[ScheduleEntry]:
        """Get all entries for a specific schedule"""
        return await self.db.scheduleentry.find_many(
            where={"scheduleId": schedule_id},
            include={"section": True},
            order={"startTime": "asc"}
        )
    # endregion

    # region--- Course Section -----
    async def create_course_section(self, data: dict) -> CourseSection:
        return await self.db.coursesection.create(data=data)
    
    async def get_course_sections(self, skip: int, limit: int, user_id: str = None, 
                                semester: str = None) -> list[CourseSection]:
        """Get course sections with filtering"""
        where_conditions = {}
        
        if user_id:
            where_conditions["userId"] = user_id
        
        if semester:
            where_conditions["semester"] = semester
        
        items = await self.db.coursesection.find_many(
            where=where_conditions,
            skip=skip,
            take=limit,
            order={"createdAt": "desc"}
        )
        
        return items
    
    async def count_course_sections(self, user_id: str = None, semester: str = None) -> int:
        """Count course sections with filtering"""
        where_conditions = {}
        
        if user_id:
            where_conditions["userId"] = user_id
        
        if semester:
            where_conditions["semester"] = semester
        
        return await self.db.coursesection.count(where=where_conditions)
    
    async def get_course_section_by_id(self, section_id: str) -> CourseSection:
        """Get course section by ID"""
        return await self.db.coursesection.find_unique(where={"id": section_id})
    
    async def delete_course_section(self, section_id: str) -> CourseSection:
        """Delete course section by ID"""
        return await self.db.coursesection.delete(where={"id": section_id})

    async def update_course_section(self, section_id: str, data: dict) -> CourseSection:
        """Update course section by ID"""
        return await self.db.coursesection.update(where={"id": section_id}, data=data)
    
    # endregion

    # region--- Study Note -----
    async def create_study_note(self, data: dict) -> StudyNote:
        return await self.db.studynote.create(data=data)
    
    async def get_study_notes(self, skip: int, limit: int, user_id: str = None, 
                            note_type: str = None, subject: str = None) -> list[StudyNote]:
        """Get study notes with filtering"""
        where_conditions = {}
        
        if user_id:
            where_conditions["userId"] = user_id
        
        if note_type:
            where_conditions["noteType"] = note_type
        
        if subject:
            where_conditions["subject"] = {"contains": subject, "mode": "insensitive"}
        
        return await self.db.studynote.find_many(
            where=where_conditions,
            skip=skip,
            take=limit,
            order={"dueAt": "asc"}
        )
    
    async def count_study_notes(self, user_id: str = None, note_type: str = None, 
                              subject: str = None) -> int:
        """Count study notes with filtering"""
        where_conditions = {}
        
        if user_id:
            where_conditions["userId"] = user_id
        
        if note_type:
            where_conditions["noteType"] = note_type
        
        if subject:
            where_conditions["subject"] = {"contains": subject, "mode": "insensitive"}
        
        return await self.db.studynote.count(where=where_conditions)
    
    async def get_study_note_by_id(self, note_id: str) -> StudyNote:
        """Get study note by ID"""
        return await self.db.studynote.find_unique(where={"id": note_id})
    
    async def update_study_note(self, note_id: str, data: dict) -> StudyNote:
        """Update study note by ID"""
        return await self.db.studynote.update(
            where={"id": note_id},
            data=data
        )
    
    async def delete_study_note(self, note_id: str) -> StudyNote:
        """Delete study note by ID"""
        return await self.db.studynote.delete(where={"id": note_id})
    
    async def get_upcoming_notes(self, user_id: str, days: int = 7) -> list[StudyNote]:
        """Get upcoming study notes within specified days"""
        from datetime import timedelta
        
        start_date = datetime.now()
        end_date = start_date + timedelta(days=days)
        
        return await self.db.studynote.find_many(
            where={
                "userId": user_id,
                "dueAt": {
                    "gte": start_date,
                    "lte": end_date
                }
            },
            order={"dueAt": "asc"}
        )
    
    async def get_overdue_notes(self, user_id: str) -> list[StudyNote]:
        """Get overdue study notes"""
        return await self.db.studynote.find_many(
            where={
                "userId": user_id,
                "dueAt": {"lt": datetime.now()},
                "isReminded": False
            },
            order={"dueAt": "asc"}
        )
    
    async def mark_note_reminded(self, note_id: str) -> StudyNote:
        """Mark study note as reminded"""
        return await self.db.studynote.update(
            where={"id": note_id},
            data={"isReminded": True}
        )
    # endregion