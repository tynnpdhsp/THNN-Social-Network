import json
from datetime import datetime, timezone
from typing import List, Optional
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
from app.modules.social.repository import SocialRepository
from app.modules.social.schemas import (
    PostCreateRequest, PostResponse, PostUpdateRequest, PostImageResponse,
    UserInfoEmbed, CommentResponse, CommentRequest
)

class SocialService:
    def __init__(self, repo: SocialRepository):
        self.repo = repo

    # --- Posts ---
    async def create_post(self, user_id: str, body: PostCreateRequest) -> PostResponse:
        post = await self.repo.create_post(data={
            "userId": user_id,
            "content": body.content,
            "visibility": body.visibility,
            "postType": body.post_type,
            "boardTagId": body.board_tag_id,
            "deletedAt": None
        })
        
        if body.images:
            await self.repo.create_post_images(post.id, [img.model_dump() for img in body.images])
            post = await self.repo.get_post_by_id(post.id)

        from app.core.cache import push_to_newsfeed, set_post_counters
        import time
        timestamp = int(post.createdAt.timestamp() if post.createdAt else time.time())
        await push_to_newsfeed(user_id, post.id, timestamp)
        await set_post_counters(post.id, 0, 0)

        return await self._map_post_to_response(post)

    async def get_posts_feed(self, user_id: Optional[str], skip: int = 0, limit: int = 20) -> List[PostResponse]:
        posts = await self.repo.get_posts_feed(skip, limit)
        return [await self._map_post_to_response(p) for p in posts]

    async def get_post_details(self, post_id: str) -> PostResponse:
        post = await self.repo.get_post_by_id(post_id)
        if not post or post.deletedAt:
            raise NotFoundException("Post not found", "POST_NOT_FOUND")
        return await self._map_post_to_response(post)

    async def update_post(self, user_id: str, post_id: str, body: PostUpdateRequest) -> PostResponse:
        post = await self.repo.get_post_by_id(post_id, include_images=False)
        if not post:
            raise NotFoundException("Post not found", "POST_NOT_FOUND")
        if post.userId != user_id:
            raise ForbiddenException("Not authorized to update this post", "NOT_AUTHORIZED")

        data = body.model_dump(exclude_none=True)
        # Map snake_case to camelCase for Prisma
        field_map = {
            "is_hidden": "isHidden",
        }
        prisma_data = {field_map.get(k, k): v for k, v in data.items()}
        
        updated_post = await self.repo.update_post(post_id, prisma_data)
        return await self._map_post_to_response(updated_post)

    async def delete_post(self, user_id: str, post_id: str):
        post = await self.repo.get_post_by_id(post_id, include_images=False)
        if not post:
            raise NotFoundException("Post not found", "POST_NOT_FOUND")
        if post.userId != user_id:
            raise ForbiddenException("Not authorized to delete this post", "NOT_AUTHORIZED")
        
        await self.repo.soft_delete_post(post_id)
        return "Post deleted successfully"

    # --- Likes ---
    async def toggle_like(self, user_id: str, post_id: str):
        post = await self.repo.get_post_by_id(post_id, include_images=False)
        if not post:
            raise NotFoundException("Post not found", "POST_NOT_FOUND")
        
        existing_like = await self.repo.get_like(post_id, "post", user_id)
        if existing_like:
            await self.repo.delete_like(existing_like.id, post_id, "post")
            return {"liked": False}
        else:
            await self.repo.create_like(post_id, "post", user_id)
            return {"liked": True}

    # --- Comments ---
    async def add_comment(self, user_id: str, post_id: str, body: CommentRequest) -> CommentResponse:
        from app.core.dependencies import get_account_repo
        from app.core.dependencies import db as prisma_db
        # Get user info for embedding
        user_repo = get_account_repo(prisma_db)
        user = await user_repo.get_user_by_id(user_id)
        if not user:
            raise NotFoundException("User not found", "USER_NOT_FOUND")
            
        user_info = {
            "id": user.id,
            "full_name": user.fullName,
            "avatar_url": user.avatarUrl
        }

        if body.parent_comment_id:
            # Add as reply to existing comment (level 2)
            parent = await self.repo.get_comment_by_id(body.parent_comment_id)
            if not parent:
                raise NotFoundException("Parent comment not found", "COMMENT_NOT_FOUND")
            
            replies = parent.replies if isinstance(parent.replies, list) else json.loads(parent.replies) if isinstance(parent.replies, str) else []
            new_reply = {
                "user_info": user_info,
                "content": body.content,
                "is_hidden": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            replies.append(new_reply)
            await self.repo.update_comment_replies(parent.id, json.dumps(replies))
            # Return full parent comment as response or just the new reply? Pattern says parent with replies.
            updated_parent = await self.repo.get_comment_by_id(parent.id)
            return self._map_comment_to_response(updated_parent)
        else:
            # Create new top-level comment
            comment = await self.repo.create_comment(post_id, "post", user_info, body.content)
            return self._map_comment_to_response(comment)

    async def get_comments(self, post_id: str) -> List[CommentResponse]:
        comments = await self.repo.get_comments_by_target(post_id, "post")
        return [self._map_comment_to_response(c) for c in comments]

    # --- Mapping Helpers ---
    async def _map_post_to_response(self, post) -> PostResponse:
        images = []
        if hasattr(post, "postImages") and post.postImages:
            images = [PostImageResponse(id=img.id, image_url=img.imageUrl, display_order=img.displayOrder) for img in post.postImages]
        
        user_info = None
        if hasattr(post, "user") and post.user:
            user_info = UserInfoEmbed(id=post.user.id, full_name=post.user.fullName, avatar_url=post.user.avatarUrl)

        like_count = post.likeCount
        comment_count = post.commentCount
        from app.core.cache import get_post_counters, set_post_counters
        counters = await get_post_counters(post.id)
        if counters:
            like_count = counters["like_count"]
            comment_count = counters["comment_count"]
        else:
            await set_post_counters(post.id, like_count, comment_count)

        return PostResponse(
            id=post.id,
            user_id=post.userId,
            user_info=user_info,
            content=post.content,
            visibility=post.visibility,
            post_type=post.postType,
            board_tag_id=post.boardTagId,
            like_count=like_count,
            comment_count=comment_count,
            is_hidden=post.isHidden,
            created_at=post.createdAt,
            updated_at=post.updatedAt,
            images=images
        )

    def _map_comment_to_response(self, comment) -> CommentResponse:
        user_info_dict = comment.userInfo # Already a dict from Prisma Json
        user_info = UserInfoEmbed(
            id=user_info_dict.get("id", ""),
            full_name=user_info_dict.get("full_name", ""),
            avatar_url=user_info_dict.get("avatar_url")
        )
        
        replies_raw = comment.replies if isinstance(comment.replies, list) else json.loads(comment.replies) if isinstance(comment.replies, str) else []
        # In this simplistic 2-level model, replies is just a list of NestedReply objects
        # We wrap them in CommentReply for current schema compatibility if needed, 
        # or just return as is if the schema matches.
        
        return CommentResponse(
            id=comment.id,
            target_id=comment.targetId,
            target_type=comment.targetType,
            user_info=user_info,
            content=comment.content,
            replies=replies_raw,
            is_hidden=comment.isHidden,
            created_at=comment.createdAt
        )
