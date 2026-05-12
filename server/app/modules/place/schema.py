from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict # type: ignore
from datetime import datetime
from typing import Optional, Literal, List

# ---- UserInfoEmbed --------
class UserInfoEmbed(BaseModel):
    id: str
    full_name: str
    avatar_url: Optional[str] = None
    
# region --------- category -------------
class PlaceCategoryRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    icon: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class PlaceCategoryResponse(BaseModel):
    id: str
    name: str
    icon: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
# endregion    

# region --------- place image -------------
class PlaceImageRequest(BaseModel):
    place_id: str = Field(..., min_length=1)
    display_order: Optional[int] = Field(0, ge=0)

    model_config = ConfigDict(from_attributes=True)

class PlaceImageResponse(BaseModel):
    id: str
    place_id: str
    image_url: str
    display_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# endregion

# region --------- place -------------
class PlaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = Field(None, max_length=500)
    category_id: str = Field(..., min_length=1)

    model_config = ConfigDict(from_attributes=True)

class PlaceUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    address: Optional[str] = Field(None, max_length=500)
    category_id: Optional[str] = Field(None, min_length=1)

    model_config = ConfigDict(from_attributes=True)

class PlaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    latitude: float
    longitude: float
    address: Optional[str]
    avg_rating: float
    rating_count: int
    created_at: datetime
    updated_at: datetime
    category: Optional[PlaceCategoryResponse]
    user_info: Optional[UserInfoEmbed]
    images: Optional[List[PlaceImageResponse]] = None

    model_config = ConfigDict(from_attributes=True)
    
# endregion

# region ------------ review ----------------
class ReviewRequest(BaseModel):
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

# region ------------ bookmark ----------------
class BookmarkResponse(BaseModel):
    id: str
    user_id: str
    place_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BookmarkPlaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    latitude: float
    longitude: float
    address: Optional[str]
    avg_rating: float
    rating_count: int
    created_at: datetime
    category: PlaceCategoryResponse
    user_info: UserInfoEmbed
    bookmarked_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BookmarkListResponse(BaseModel):
    items: list[BookmarkPlaceResponse]
    total: int
    skip: int
    limit: int

    model_config = ConfigDict(from_attributes=True)

class BookmarkCheckResponse(BaseModel):
    is_bookmarked: bool
    bookmark_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
# endregion

# region ------------ nearby places ----------------
class NearbyPlaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    latitude: float
    longitude: float
    address: Optional[str]
    avg_rating: float
    rating_count: int
    distance: float  # distance in km
    category: Optional[PlaceCategoryResponse]
    user_info: Optional[UserInfoEmbed]
    images: Optional[List[PlaceImageResponse]] = None

    model_config = ConfigDict(from_attributes=True)

class NearbyPlacesListResponse(BaseModel):
    data: list[NearbyPlaceResponse]

    model_config = ConfigDict(from_attributes=True)
# endregion