from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_social_service, get_current_user_id
from app.modules.account.schemas import MessageResponse
from app.modules.social.service import SocialService
from app.modules.social.schemas import (
    PostResponse, BoardTagResponse, BoardPostCreateRequest,
    PaginatedBoardResponse, CommentRequest, CommentResponse,
)

router = APIRouter(prefix="/board", tags=["Board - Bảng tin chung"])


# --- Tags ---

@router.get("/tags", response_model=List[BoardTagResponse])
async def get_board_tags(
    svc: SocialService = Depends(get_social_service),
):
    """Lấy danh sách tag bảng tin (Tìm trọ, Mất đồ, ...)."""
    return await svc.get_board_tags()


# --- Board Posts ---

@router.get("/posts", response_model=PaginatedBoardResponse)
async def get_board_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    tag_id: Optional[str] = Query(None, description="Filter by board tag ID"),
    svc: SocialService = Depends(get_social_service),
):
    """Lấy bài viết bảng tin chung, có thể lọc theo tag."""
    return await svc.get_board_posts(skip, limit, tag_id)


@router.post("/posts", response_model=PostResponse)
async def create_board_post(
    body: BoardPostCreateRequest,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    """Tạo bài viết bảng tin chung (bắt buộc chọn tag)."""
    return await svc.create_board_post(user_id, body)


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_board_post_details(
    post_id: str,
    svc: SocialService = Depends(get_social_service),
):
    """Xem chi tiết bài viết bảng tin."""
    return await svc.get_post_details(post_id)


# --- Board Post Actions (reuse social service) ---

@router.post("/posts/{post_id}/like", response_model=dict)
async def toggle_board_like(
    post_id: str,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.toggle_like(user_id, post_id)


@router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
async def get_board_comments(
    post_id: str,
    svc: SocialService = Depends(get_social_service),
):
    return await svc.get_comments(post_id)


@router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def add_board_comment(
    post_id: str,
    body: CommentRequest,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.add_comment(user_id, post_id, body)
