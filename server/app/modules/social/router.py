from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request

from app.core.dependencies import get_social_service, get_current_user_id, get_optional_user_id
from app.modules.account.schemas import MessageResponse
from app.modules.social.service import SocialService
from app.modules.social.schemas import (
    PostCreateRequest, PostResponse, PostUpdateRequest,
    CommentRequest, CommentResponse,
    PaginatedFeedResponse,
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

@router.get("/posts", response_model=PaginatedFeedResponse)
async def get_posts_feed(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user_id: Optional[str] = Depends(get_optional_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.get_posts_feed(user_id, skip, limit)

@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post_details(
    post_id: str,
    svc: SocialService = Depends(get_social_service),
):
    return await svc.get_post_details(post_id)


# --- Friends ---

@router.post("/friends/requests/{target_user_id}", response_model=dict)
async def send_friend_request(
    target_user_id: str,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.send_friend_request(user_id, target_user_id)

@router.get("/friends/requests")
async def incoming_friend_requests(
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.list_incoming_friend_requests(user_id)

@router.post("/friends/requests/{requester_id}/accept", response_model=dict)
async def accept_friend_request(
    requester_id: str,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.accept_friend_request(user_id, requester_id)

@router.post("/friends/requests/{requester_id}/reject", response_model=dict)
async def reject_friend_request(
    requester_id: str,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.reject_friend_request(user_id, requester_id)

@router.delete("/friends/{other_user_id}")
async def unfriend(
    other_user_id: str,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.unfriend(user_id, other_user_id)

@router.get("/friends")
async def list_friends(
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.list_friends(user_id)

# --- Blocks ---

@router.post("/blocks/{target_user_id}")
async def block_user(
    target_user_id: str,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.block_user(user_id, target_user_id)

@router.get("/blocks")
async def list_blocked(
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.list_blocked(user_id)

@router.delete("/blocks/{target_user_id}")
async def unblock_user(
    target_user_id: str,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.unblock_user(user_id, target_user_id)

# --- Reports ---

@router.post("/reports/{target_type}/{target_id}", response_model=dict)
async def report_content(
    target_type: str,
    target_id: str,
    reason: str = Query(...),
    description: str | None = None,
    user_id: str = Depends(get_current_user_id),
    svc: SocialService = Depends(get_social_service),
):
    return await svc.report_content(user_id, target_type, target_id, reason, description)

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
