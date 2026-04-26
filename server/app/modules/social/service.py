import json
from datetime import datetime, timezone
from typing import List, Optional
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
from app.modules.social.repository import SocialRepository
from app.modules.social.schemas import (
    PostCreateRequest, PostResponse, PostUpdateRequest, PostImageResponse,
    UserInfoEmbed, CommentResponse, CommentRequest,
    PaginatedFeedResponse, PaginatedBoardResponse, BoardTagResponse,
    BoardPostCreateRequest,
)
from app.modules.notification.service import NotificationService

class SocialService:
    def __init__(self, repo: SocialRepository, notification_svc: NotificationService = None):
        self.repo = repo
        self.notification_svc = notification_svc

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

    async def get_posts_feed(self, user_id: str | None, skip: int = 0, limit: int = 20) -> PaginatedFeedResponse:
        friend_ids = None
        if user_id:
            friend_ids = await self.repo.get_friend_ids(user_id)
        
        posts = await self.repo.get_posts_feed(
            skip, limit, post_type="feed",
            friend_ids=friend_ids, viewer_id=user_id,
        )
        total = await self.repo.count_posts_feed(
            post_type="feed",
            friend_ids=friend_ids, viewer_id=user_id,
        )
        items = [await self._map_post_to_response(p) for p in posts]
        return PaginatedFeedResponse(posts=items, total=total, skip=skip, limit=limit)

    async def get_post_details(self, post_id: str) -> PostResponse:
        post = await self.repo.get_post_by_id(post_id)
        if not post or post.deletedAt:
            raise NotFoundException("Không tìm thấy bài viết", "POST_NOT_FOUND")
        return await self._map_post_to_response(post)

    async def update_post(self, user_id: str, post_id: str, body: PostUpdateRequest) -> PostResponse:
        post = await self.repo.get_post_by_id(post_id, include_images=False)
        if not post:
            raise NotFoundException("Không tìm thấy bài viết", "POST_NOT_FOUND")
        if post.userId != user_id:
            raise ForbiddenException("Không có quyền cập nhật bài viết này", "NOT_AUTHORIZED")

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
            raise NotFoundException("Không tìm thấy bài viết", "POST_NOT_FOUND")
        if post.userId != user_id:
            raise ForbiddenException("Không có quyền xóa bài viết này", "NOT_AUTHORIZED")
        
        await self.repo.soft_delete_post(post_id)
        return "Đã xóa bài viết thành công"

    # --- Likes ---
    async def toggle_like(self, user_id: str, post_id: str):
        post = await self.repo.get_post_by_id(post_id, include_images=False)
        if not post:
            raise NotFoundException("Không tìm thấy bài viết", "POST_NOT_FOUND")
        
        existing_like = await self.repo.get_like(post_id, "post", user_id)
        if existing_like:
            await self.repo.delete_like(existing_like.id, post_id, "post")
            return {"liked": False}
        else:
            await self.repo.create_like(post_id, "post", user_id)
            # Bắn thông báo cho chủ bài viết (không tự thông báo cho chính mình)
            if self.notification_svc and post.userId != user_id:
                actor_name = await self._get_user_name(user_id)
                await self.notification_svc.notify_like(actor_name, post.userId, post_id)
            return {"liked": True}

    # --- Comments ---
    async def add_comment(self, user_id: str, post_id: str, body: CommentRequest) -> CommentResponse:
        from app.core.dependencies import get_account_repo
        from app.core.dependencies import db as prisma_db
        # Get user info for embedding
        user_repo = get_account_repo(prisma_db)
        user = await user_repo.get_user_by_id(user_id)
        if not user:
            raise NotFoundException("Không tìm thấy người dùng", "USER_NOT_FOUND")
            
        user_info = {
            "id": user.id,
            "full_name": user.fullName,
            "avatar_url": user.avatarUrl
        }

        if body.parent_comment_id:
            # Add as reply to existing comment (level 2)
            parent = await self.repo.get_comment_by_id(body.parent_comment_id)
            if not parent:
                raise NotFoundException("Không tìm thấy bình luận gốc", "COMMENT_NOT_FOUND")
            
            replies = parent.replies if isinstance(parent.replies, list) else json.loads(parent.replies) if isinstance(parent.replies, str) else []
            new_reply = {
                "user_info": user_info,
                "content": body.content,
                "is_hidden": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            replies.append(new_reply)
            await self.repo.update_comment_replies(parent.id, json.dumps(replies))

            # Thông báo cho chủ comment gốc
            parent_user_id = parent.userInfo.get("id", "") if isinstance(parent.userInfo, dict) else ""
            if self.notification_svc and parent_user_id and parent_user_id != user_id:
                await self.notification_svc.notify_reply(user.fullName, parent_user_id, post_id)

            updated_parent = await self.repo.get_comment_by_id(parent.id)
            return self._map_comment_to_response(updated_parent)
        else:
            # Create new top-level comment
            comment = await self.repo.create_comment(post_id, "post", user_info, body.content)

            # Thông báo cho chủ bài viết
            post = await self.repo.get_post_by_id(post_id, include_images=False)
            if self.notification_svc and post and post.userId != user_id:
                await self.notification_svc.notify_comment(user.fullName, post.userId, post_id)

            return self._map_comment_to_response(comment)

    async def get_comments(self, post_id: str) -> List[CommentResponse]:
        comments = await self.repo.get_comments_by_target(post_id, "post")
        return [self._map_comment_to_response(c) for c in comments]

    # --- Friend management ---
    async def send_friend_request(self, user_id: str, target_user_id: str) -> dict:
        # Simple flow: create pending request
        await self.repo.send_friend_request(user_id, target_user_id)
        return {"status": "đã gửi yêu cầu", "to": target_user_id}

    async def list_incoming_friend_requests(self, user_id: str) -> list:
        requests = await self.repo.get_incoming_friend_requests(user_id)
        # Return minimal view
        return [{"from": r.requesterId, "created_at": r.createdAt} for r in requests]

    async def accept_friend_request(self, user_id: str, requester_id: str) -> dict:
        updated = await self.repo.accept_friend_request(requester_id, user_id)
        if updated:
            return {"status": "đã chấp nhận", "from": requester_id, "to": user_id}
        return {"status": "không tìm thấy"}

    async def reject_friend_request(self, user_id: str, requester_id: str) -> dict:
        updated = await self.repo.reject_friend_request(requester_id, user_id)
        if updated:
            return {"status": "đã từ chối", "from": requester_id, "to": user_id}
        return {"status": "không tìm thấy"}

    async def unfriend(self, user_id: str, other_user_id: str) -> dict:
        ok = await self.repo.remove_friendship(user_id, other_user_id)
        return {"status": "đã hủy kết bạn" if ok else "không tìm thấy"}

    async def list_friends(self, user_id: str) -> list:
        ids = await self.repo.get_friend_ids(user_id)
        return ids

    # --- Block management ---
    async def block_user(self, user_id: str, target_user_id: str) -> dict:
        # Create block entry
        await self.repo.block_user(user_id, target_user_id)
        return {"status": "đã chặn", "blocked": target_user_id}

    async def list_blocked(self, user_id: str) -> list:
        blocked = await self.repo.get_blocked_users(user_id)
        return [b.blockedId for b in blocked]

    async def unblock_user(self, user_id: str, target_user_id: str) -> dict:
        await self.repo.unblock_user(user_id, target_user_id)
        return {"status": "đã bỏ chặn", "unblocked": target_user_id}

    # --- Reports ---
    async def report_content(self, reporter_id: str, target_type: str, target_id: str, reason: str, description: str | None = None) -> dict:
        report = await self.repo.create_report(reporter_id, target_type, target_id, reason, description)
        return {"report_id": report.id, "status": report.status}

    # --- Board ---
    async def get_board_tags(self) -> List[BoardTagResponse]:
        tags = await self.repo.get_board_tags()
        return [BoardTagResponse(id=t.id, name=t.name, slug=t.slug) for t in tags]

    async def get_board_posts(
        self, skip: int = 0, limit: int = 20, tag_id: str | None = None,
    ) -> PaginatedBoardResponse:
        posts = await self.repo.get_board_posts(skip, limit, tag_id)
        total = await self.repo.count_board_posts(tag_id)
        items = [await self._map_post_to_response(p) for p in posts]
        return PaginatedBoardResponse(posts=items, total=total, skip=skip, limit=limit)

    async def create_board_post(self, user_id: str, body: BoardPostCreateRequest) -> PostResponse:
        post = await self.repo.create_post(data={
            "userId": user_id,
            "content": body.content,
            "visibility": "public",
            "postType": "board",
            "boardTagId": body.board_tag_id,
            "deletedAt": None,
        })
        if body.images:
            await self.repo.create_post_images(post.id, [img.model_dump() for img in body.images])
            post = await self.repo.get_post_by_id(post.id)
        return await self._map_post_to_response(post)

    # --- Mapping Helpers ---
    async def _map_post_to_response(self, post) -> PostResponse:
        images = []
        if hasattr(post, "postImages") and post.postImages:
            images = [PostImageResponse(id=img.id, image_url=img.imageUrl, display_order=img.displayOrder) for img in post.postImages]
        
        user_info = None
        if hasattr(post, "user") and post.user:
            user_info = UserInfoEmbed(id=post.user.id, full_name=post.user.fullName, avatar_url=post.user.avatarUrl)

        # Board tag name
        board_tag_name = None
        if hasattr(post, "boardTag") and post.boardTag:
            board_tag_name = post.boardTag.name

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
            board_tag_name=board_tag_name,
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

    async def _get_user_name(self, user_id: str) -> str:
        """Lấy tên user để hiển thị trong thông báo."""
        from app.core.dependencies import get_account_repo
        from app.core.dependencies import db as prisma_db
        user_repo = get_account_repo(prisma_db)
        user = await user_repo.get_user_by_id(user_id)
        return user.fullName if user else "Người dùng"
