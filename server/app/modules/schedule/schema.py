from pydantic import BaseModel, Field, ConfigDict # type: ignore
from datetime import datetime
from typing import Optional, Literal

# ---- UserInfoEmbed --------
class UserInfoEmbed(BaseModel):
    id: str
    full_name: str
    avatar_url: Optional[str] = None

# region --------- Schedule -------------
class ScheduleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    source: Literal["manual", "excel", "ai"] = Field("manual", description="Schedule source")

    model_config = ConfigDict(from_attributes=True)

class ScheduleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    is_active: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)

class ScheduleResponse(BaseModel):
    id: str
    user_id: str
    name: str
    is_active: bool
    source: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ScheduleListResponse(BaseModel):
    items: list[ScheduleResponse]
    total: int
    skip: int
    limit: int

    model_config = ConfigDict(from_attributes=True)
# endregion

# region --------- Schedule Entry -------------
class ScheduleEntryCreate(BaseModel):
    schedule_id: str
    section_id: Optional[str] = None
    entry_type: Literal["class", "exam", "custom"] = Field(..., description="Entry type")
    title: str = Field(..., min_length=1, max_length=200)
    day_of_week: Optional[int] = Field(None, ge=1, le=7, description="Day of week (1-7)")
    start_time: str = Field(..., description="Start time in HH:mm format")
    end_time: str = Field(..., description="End time in HH:mm format")
    room: Optional[str] = Field(None, max_length=100)
    date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class ScheduleEntryUpdate(BaseModel):
    entry_type: Optional[Literal["class", "exam", "custom"]] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    day_of_week: Optional[int] = Field(None, ge=1, le=7)
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room: Optional[str] = Field(None, max_length=100)
    date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class ScheduleEntryResponse(BaseModel):
    id: str
    schedule_id: str
    section_id: Optional[str]
    entry_type: str
    title: str
    day_of_week: Optional[int]
    start_time: str
    end_time: str
    room: Optional[str]
    date: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ScheduleEntryListResponse(BaseModel):
    items: list[ScheduleEntryResponse]
    total: int
    skip: int
    limit: int

    model_config = ConfigDict(from_attributes=True)
# endregion

# region --------- Course Section -------------
class CourseSectionCreate(BaseModel):
    course_code: str = Field(..., min_length=1, max_length=20)
    course_name: str = Field(..., min_length=1, max_length=200)
    section_code: Optional[str] = Field(None, max_length=20)
    instructor: Optional[str] = Field(None, max_length=100)
    day_of_week: int = Field(..., ge=1, le=7, description="Day of week (1-7)")
    start_time: str = Field(..., description="Start time in HH:mm format")
    end_time: str = Field(..., description="End time in HH:mm format")
    room: Optional[str] = Field(None, max_length=100)
    semester: Optional[str] = Field(None, max_length=50)

    model_config = ConfigDict(from_attributes=True)

class CourseSectionResponse(BaseModel):
    id: str
    user_id: str
    course_code: str
    course_name: str
    section_code: Optional[str]
    instructor: Optional[str]
    day_of_week: int
    start_time: str
    end_time: str
    room: Optional[str]
    semester: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CourseSectionListResponse(BaseModel):
    items: list[CourseSectionResponse]
    total: int
    skip: int
    limit: int

    model_config = ConfigDict(from_attributes=True)
# endregion

# region --------- Study Note -------------
class StudyNoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    subject: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    due_at: datetime
    note_type: Literal["deadline", "exam", "event"] = Field("deadline", description="Note type")
    remind_before_minutes: int = Field(60, ge=0, description="Remind before minutes")

    model_config = ConfigDict(from_attributes=True)

class StudyNoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    subject: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    due_at: Optional[datetime] = None
    note_type: Optional[Literal["deadline", "exam", "event"]] = None
    remind_before_minutes: Optional[int] = Field(None, ge=0)

    model_config = ConfigDict(from_attributes=True)

class StudyNoteResponse(BaseModel):
    id: str
    user_id: str
    title: str
    subject: Optional[str]
    description: Optional[str]
    due_at: datetime
    note_type: str
    remind_before_minutes: int
    is_reminded: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class StudyNoteListResponse(BaseModel):
    items: list[StudyNoteResponse]
    total: int
    skip: int
    limit: int

    model_config = ConfigDict(from_attributes=True)
# endregion

# region --------- Query Models -------------
class ScheduleListQuery(BaseModel):
    skip: int = Field(0, ge=0, description="Number of items to skip")
    limit: int = Field(20, ge=1, le=100, description="Number of items to return")
    is_active: Optional[bool] = Field(None, description="Filter by active status")

    model_config = ConfigDict(from_attributes=True)

class ScheduleEntryListQuery(BaseModel):
    skip: int = Field(0, ge=0, description="Number of items to skip")
    limit: int = Field(20, ge=1, le=100, description="Number of items to return")
    schedule_id: Optional[str] = Field(None, description="Filter by schedule ID")
    entry_type: Optional[Literal["class", "exam", "custom"]] = Field(None, description="Filter by entry type")
    day_of_week: Optional[int] = Field(None, ge=1, le=7, description="Filter by day of week")

    model_config = ConfigDict(from_attributes=True)

class CourseSectionListQuery(BaseModel):
    skip: int = Field(0, ge=0, description="Number of items to skip")
    limit: int = Field(20, ge=1, le=100, description="Number of items to return")
    semester: Optional[str] = Field(None, description="Filter by semester")

    model_config = ConfigDict(from_attributes=True)

class StudyNoteListQuery(BaseModel):
    skip: int = Field(0, ge=0, description="Number of items to skip")
    limit: int = Field(20, ge=1, le=100, description="Number of items to return")
    note_type: Optional[Literal["deadline", "exam", "event"]] = Field(None, description="Filter by note type")
    subject: Optional[str] = Field(None, description="Filter by subject")

    model_config = ConfigDict(from_attributes=True)
# endregion