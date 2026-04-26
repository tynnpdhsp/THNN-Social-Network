from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

# --- User Info Embed ---
class UserInfoEmbed(BaseModel):
    id: str
    full_name: str
    avatar_url: Optional[str] = None

# --- Likes ---
class LikeResponse(BaseModel):
    id: str
    target_id: str
    target_type: str
    user_id: str
    created_at: datetime

# --- Comments (Nested 2 levels) ---
class NestedReply(BaseModel):
    user_info: UserInfoEmbed
    content: str
    is_hidden: bool = False
    created_at: datetime = Field(default_factory=datetime.now)

class CommentReply(BaseModel):
    id: str = Field(default_factory=lambda: "temp_id") # For frontend mapping
    user_info: UserInfoEmbed
    content: str
    replies: List[NestedReply] = []
    is_hidden: bool = False
    created_at: datetime = Field(default_factory=datetime.now)

class CommentRequest(BaseModel):
    content: str = Field(..., max_length=2000)
    parent_comment_id: Optional[str] = None # If provided, it's a 2nd level reply

class CommentResponse(BaseModel):
    id: str
    target_id: str
    target_type: str
    user_info: UserInfoEmbed
    content: str
    replies: List[CommentReply] = []
    is_hidden: bool
    created_at: datetime

# --- Posts ---
class PostImageCreate(BaseModel):
    image_url: str
    display_order: int = 0

class PostImageResponse(BaseModel):
    id: str
    image_url: str
    display_order: int

class PostCreateRequest(BaseModel):
    content: str
    visibility: str = "public" # 'public' | 'friends' | 'private'
    post_type: str = "feed" # 'feed' | 'board'
    board_tag_id: Optional[str] = None
    images: List[PostImageCreate] = []

class PostUpdateRequest(BaseModel):
    content: Optional[str] = None
    visibility: Optional[str] = None
    is_hidden: Optional[bool] = None

class PostResponse(BaseModel):
    id: str
    user_id: str
    user_info: Optional[UserInfoEmbed] = None
    content: str
    visibility: str
    post_type: str
    board_tag_id: Optional[str] = None
    board_tag_name: Optional[str] = None
    like_count: int
    comment_count: int
    is_hidden: bool
    created_at: datetime
    updated_at: datetime
    images: List[PostImageResponse] = []
    is_liked: bool = False # Contextual info for the current user

    model_config = ConfigDict(from_attributes=True)


# --- Paginated Responses ---
class PaginatedFeedResponse(BaseModel):
    posts: List[PostResponse]
    total: int
    skip: int
    limit: int


# --- Board ---
class BoardTagResponse(BaseModel):
    id: str
    name: str
    slug: str

    model_config = ConfigDict(from_attributes=True)


class BoardPostCreateRequest(BaseModel):
    content: str
    board_tag_id: str
    images: List[PostImageCreate] = []


class PaginatedBoardResponse(BaseModel):
    posts: List[PostResponse]
    total: int
    skip: int
    limit: int

