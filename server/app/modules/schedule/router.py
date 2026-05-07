from fastapi import APIRouter, Query, UploadFile, File, Depends # type: ignore
from app.modules.schedule.schema import (
    ScheduleCreate, ScheduleUpdate, ScheduleResponse, ScheduleListQuery, ScheduleListResponse,
    ScheduleEntryCreate, ScheduleEntryUpdate, ScheduleEntryResponse, ScheduleEntryListQuery, ScheduleEntryListResponse,
    StudyNoteCreate, StudyNoteUpdate, StudyNoteResponse, StudyNoteListQuery, StudyNoteListResponse
)
from app.modules.schedule.service import ScheduleService
from app.core.dependencies import Depends, get_schedule_service, require_active_user

router = APIRouter(prefix="/schedules", tags=["Schedule"])

# region------------- Schedule --------------------------

@router.post("/", response_model=ScheduleResponse)
async def create_schedule(
    data: ScheduleCreate,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Create a new schedule"""
    return await svc.create_schedule(data, user_id)

@router.get("/", response_model=ScheduleListResponse)
async def get_schedules(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return"),
    is_active: bool = Query(None, description="Filter by active status"),
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Get schedules with pagination and filtering"""
    query = ScheduleListQuery(
        skip=skip,
        limit=limit,
        is_active=is_active
    )
    
    return await svc.get_schedules(query, user_id)

@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule_by_id(
    schedule_id: str,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Get schedule by ID"""
    return await svc.get_schedule_by_id(schedule_id, user_id)

@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: str,
    data: ScheduleUpdate,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Update schedule by ID"""
    return await svc.update_schedule(schedule_id, data, user_id)

@router.delete("/{schedule_id}", response_model=ScheduleResponse)
async def delete_schedule(
    schedule_id: str,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Delete schedule by ID"""
    return await svc.delete_schedule(schedule_id, user_id)

@router.post("/{schedule_id}/set-active", response_model=ScheduleResponse)
async def set_active_schedule(
    schedule_id: str,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Set schedule as active"""
    return await svc.set_active_schedule(schedule_id, user_id)

# endregion

# region------------- Schedule Entry --------------------------

@router.post("/{schedule_id}/entries", response_model=ScheduleEntryResponse)
async def create_schedule_entry(
    schedule_id: str,
    data: ScheduleEntryCreate,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Create a new schedule entry"""
    # Set schedule_id from path parameter
    data.schedule_id = schedule_id
    return await svc.create_schedule_entry(data, user_id)

@router.get("/entries/", response_model=ScheduleEntryListResponse)
async def get_schedule_entries(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return"),
    schedule_id: str = Query(None, description="Filter by schedule ID"),
    entry_type: str = Query(None, description="Filter by entry type"),
    day_of_week: int = Query(None, ge=1, le=7, description="Filter by day of week"),
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Get schedule entries with pagination and filtering"""
    query = ScheduleEntryListQuery(
        skip=skip,
        limit=limit,
        schedule_id=schedule_id,
        entry_type=entry_type,
        day_of_week=day_of_week
    )
    
    return await svc.get_schedule_entries(query, user_id)

@router.get("/entries/{entry_id}", response_model=ScheduleEntryResponse)
async def get_schedule_entry_by_id(
    entry_id: str,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Get schedule entry by ID"""
    return await svc.get_schedule_entry_by_id(entry_id, user_id)

@router.put("/entries/{entry_id}", response_model=ScheduleEntryResponse)
async def update_schedule_entry(
    entry_id: str,
    data: ScheduleEntryUpdate,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Update schedule entry by ID"""
    return await svc.update_schedule_entry(entry_id, data, user_id)

@router.delete("/entries/{entry_id}", response_model=ScheduleEntryResponse)
async def delete_schedule_entry(
    entry_id: str,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Delete schedule entry by ID"""
    return await svc.delete_schedule_entry(entry_id, user_id)

@router.get("/{schedule_id}/entries", response_model=list[ScheduleEntryResponse])
async def get_entries_by_schedule(
    schedule_id: str,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Get all entries for a specific schedule"""
    return await svc.get_entries_by_schedule(schedule_id, user_id)

# endregion

# region------------- Course Section Import --------------------------

@router.post("/import-course-sections")
async def import_course_sections(
    file: UploadFile = File(...),
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Import course sections from file"""
    # TODO: Implement file processing logic
    # 1. Read and parse file
    # 2. Delete old course sections
    # 4. Rollback on failure
    pass

# endregion

# region------------- Study Note --------------------------

@router.post("/notes", response_model=StudyNoteResponse)
async def create_study_note(
    data: StudyNoteCreate,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Create a new study note"""
    return await svc.create_study_note(data, user_id)

@router.get("/notes/", response_model=StudyNoteListResponse)
async def get_study_notes(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return"),
    note_type: str = Query(None, description="Filter by note type"),
    subject: str = Query(None, description="Filter by subject"),
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Get study notes with pagination and filtering"""
    query = StudyNoteListQuery(
        skip=skip,
        limit=limit,
        note_type=note_type,
        subject=subject
    )
    
    return await svc.get_study_notes(query, user_id)

@router.get("/notes/upcoming", response_model=list[StudyNoteResponse])
async def get_upcoming_notes(
    days: int = Query(7, ge=1, le=30, description="Number of days ahead to look for notes"),
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Get upcoming study notes within specified days"""
    return await svc.get_upcoming_notes(user_id, days)

@router.get("/notes/overdue", response_model=list[StudyNoteResponse])
async def get_overdue_notes(
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Get overdue study notes"""
    return await svc.get_overdue_notes(user_id)

@router.get("/notes/{note_id}", response_model=StudyNoteResponse)
async def get_study_note_by_id(
    note_id: str,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Get study note by ID"""
    return await svc.get_study_note_by_id(note_id, user_id)

@router.put("/notes/{note_id}", response_model=StudyNoteResponse)
async def update_study_note(
    note_id: str,
    data: StudyNoteUpdate,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Update study note by ID"""
    return await svc.update_study_note(note_id, data, user_id)

@router.delete("/notes/{note_id}", response_model=StudyNoteResponse)
async def delete_study_note(
    note_id: str,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Delete study note by ID"""
    return await svc.delete_study_note(note_id, user_id)

# endregion