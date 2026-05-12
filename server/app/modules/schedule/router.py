from fastapi import APIRouter, Query, UploadFile, File, Depends, HTTPException # type: ignore
try:
    import pandas as pd
    import io
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
from app.modules.schedule.schema import (
    CourseSectionResponse, CourseSectionUpdate, ScheduleCreate, ScheduleUpdate, ScheduleResponse, ScheduleListQuery, ScheduleListResponse,
    ScheduleEntryCreate, ScheduleEntryUpdate, ScheduleEntryResponse, ScheduleEntryListQuery, ScheduleEntryListResponse,
    StudyNoteCreate, StudyNoteUpdate, StudyNoteResponse, StudyNoteListQuery, StudyNoteListResponse, CourseSectionCreate
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

@router.get("/detail/{schedule_id}", response_model=ScheduleResponse)
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

# region------------- Course Section --------------------------

@router.post("/course-sections", response_model=list[CourseSectionResponse])
async def import_course_sections(
    data: list[CourseSectionCreate],
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Bulk import course sections from JSON"""
    return await svc.bulk_create_course_sections(data, user_id)

@router.post("/course-sections/excel", response_model=list[CourseSectionResponse])
async def import_course_sections_excel(
    file: UploadFile = File(...),
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Bulk import course sections from Excel"""
    if not PANDAS_AVAILABLE:
        raise HTTPException(status_code=501, detail="Excel import is not available. Please install pandas and openpyxl on the server.")
    
    content = await file.read()
    df = pd.read_excel(io.BytesIO(content))
    
    # Convert dataframe to list of CourseSectionCreate
    # Mapping columns (case insensitive search for best match)
    data = []
    for _, row in df.iterrows():
        # Simple mapping, assuming columns are named correctly or similar
        # course_code, course_name, day_of_week, start_time, end_time, room
        data.append(CourseSectionCreate(
            course_code=str(row.get('Mã môn', row.get('course_code', ''))),
            course_name=str(row.get('Tên môn', row.get('course_name', ''))),
            day_of_week=int(row.get('Thứ', row.get('day_of_week', 2))),
            start_time=str(row.get('Bắt đầu', row.get('start_time', '07:00'))),
            end_time=str(row.get('Kết thúc', row.get('end_time', '09:00'))),
            room=str(row.get('Phòng', row.get('room', ''))),
            instructor=str(row.get('Giảng viên', row.get('instructor', ''))),
            semester=str(row.get('Học kỳ', row.get('semester', '')))
        ))
    
    return await svc.bulk_create_course_sections(data, user_id)

@router.get("/course-sections")
async def get_all_course_sections(
    skip: int = 0,
    limit: int = 100,
    semester: str = None,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Get all course sections"""
    return await svc.get_all_course_sections(user_id, skip, limit, semester)

@router.put("/course-sections/{section_id}", response_model=CourseSectionResponse)
async def update_course_section(
    section_id: str,
    data: CourseSectionUpdate,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Update course section by ID"""
    return await svc.update_course_section(section_id, data, user_id)

@router.delete("/course-sections/{section_id}", response_model=CourseSectionResponse)
async def delete_course_section(
    section_id: str,
    user_id = Depends(require_active_user),
    svc: ScheduleService = Depends(get_schedule_service)
):
    """Delete course section by ID"""
    return await svc.delete_course_section(section_id, user_id)

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