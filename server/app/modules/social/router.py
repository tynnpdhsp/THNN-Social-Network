from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request

from app.core.dependencies import get_social_service, get_current_user_id, get_optional_user_id
from app.modules.account.schemas import MessageResponse
from app.modules.social.service import SocialService
from app.modules.social.schemas import (
    PostCreateRequest, PostResponse, PostUpdateRequest,
    CommentRequest, CommentResponse
)

router = APIRouter(prefix="/social", tags=["Social Network"])

# --- Posts ---

@router.post("/posts", response_model=PostResponse)
async def create_post(
    body: PostCreateRequest,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.create_post(user_id, body)

@router.get("/posts", response_model=List[PostResponse])
async def get_posts_feed(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user_id: Optional[str] = Depends(get_optional_user_id), # Optional for viewing public feed
    svc: SocialService = Depends(get_social_service),
):
    return await svc.get_posts_feed(user_id, skip, limit)

@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post_details(
    post_id: str,
    svc: SocialService = Depends(get_social_service),
):
    return await svc.get_post_details(post_id)

@router.put("/posts/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: str,
    body: PostUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.update_post(user_id, post_id, body)

@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    message = await svc.delete_post(user_id, post_id)
    return {"message": message}

# --- Actions ---

@router.post("/posts/{post_id}/like", response_model=dict)
async def toggle_like(
    post_id: str,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.toggle_like(user_id, post_id)

# --- Comments ---

@router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
async def get_comments(
    post_id: str,
    svc: SocialService = Depends(get_social_service),
):
    return await svc.get_comments(post_id)

@router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def add_comment(
    post_id: str,
    body: CommentRequest,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.add_comment(user_id, post_id, body)
