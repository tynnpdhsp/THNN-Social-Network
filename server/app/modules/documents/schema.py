from pydantic import BaseModel, Field, ConfigDict # type: ignore
from datetime import datetime
from typing import Optional, Literal

# ---- UserInfoEmbed --------
class UserInfoEmbed(BaseModel):
    id: str
    full_name: str
    avatar_url: Optional[str] = None
# region --------- category -------------
class DocumentCategoryRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

    model_config = ConfigDict(from_attributes=True)

class DocumentCategoryResponse(BaseModel):
    id: str
    name: str

    model_config = ConfigDict(from_attributes=True)
#endregion

# region ------------ document ----------------
class DocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    category_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    category_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class DocumentResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    file_url: str
    file_name: str
    file_size: int
    file_type: str
    avg_rating: float
    rating_count: int
    download_count: int
    created_at: datetime
    updated_at: datetime

    user_info: Optional[UserInfoEmbed]
    category: Optional[DocumentCategoryResponse] = None

    model_config = ConfigDict(from_attributes=True)

class DocumentListQuery(BaseModel):
    skip: int = Field(0, ge=0, description="Number of items to skip")
    limit: int = Field(20, ge=1, le=100, description="Number of items to return")
    sort: Literal["rating", "popular", "newest", "oldest"] = Field("newest", description="Sort order")
    category_id: Optional[str] = Field(None, description="Filter by category")
    search: Optional[str] = Field(None, description="Search in title and description")

    model_config = ConfigDict(from_attributes=True)

class DocumentPaginationRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(20, le=100)

class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int
    skip: int
    limit: int

    model_config = ConfigDict(from_attributes=True)

# region ------------ review ----------------
class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    comment: Optional[str] = Field(None, max_length=1000, description="Review comment")

class ReviewResponse(BaseModel):
    id: str
    target_id: str
    target_type: str
    user_info: UserInfoEmbed
    rating: int
    comment: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ReviewListResponse(BaseModel):
    items: list[ReviewResponse]
    total: int
    skip: int
    limit: int

    model_config = ConfigDict(from_attributes=True)

# endregion