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
        blocked_ids = None
        privacy_hidden_ids = []  # Users whose privacy restricts post visibility
        
        if user_id:
            friend_ids = await self.repo.get_friend_ids(user_id)
            # Fetch users who blocked viewer or viewer blocked
            blocks = await self.repo.db.userblock.find_many(
                where={
                    "OR": [
                        {"blockerId": user_id},
                        {"blockedId": user_id}
                    ]
                }
            )
            blocked_ids = list(set([b.blockedId if b.blockerId == user_id else b.blockerId for b in blocks]))
            
            # Kiểm tra quyền riêng tư: loại bỏ bài viết từ người đặt whoCanSeePosts khác "everyone"
            restricted_settings = await self.repo.db.privacysetting.find_many(
                where={"whoCanSeePosts": {"not": "everyone"}}
            )
            for ps in restricted_settings:
                if ps.userId == user_id:
                    continue  # Luôn hiển thị bài của chính mình
                if ps.whoCanSeePosts == "only_me":
                    privacy_hidden_ids.append(ps.userId)
                elif ps.whoCanSeePosts == "friends":
                    if not friend_ids or ps.userId not in friend_ids:
                        privacy_hidden_ids.append(ps.userId)
            
            # Gộp vào blocked_ids để lọc chung
            if privacy_hidden_ids:
                blocked_ids = list(set((blocked_ids or []) + privacy_hidden_ids))
        
        posts = await self.repo.get_posts_feed(
            skip, limit, post_type="feed",
            friend_ids=friend_ids, viewer_id=user_id,
            blocked_ids=blocked_ids
        )
        total = await self.repo.count_posts_feed(
            post_type="feed",
            friend_ids=friend_ids, viewer_id=user_id,
            blocked_ids=blocked_ids
        )
        items = [await self._map_post_to_response(p) for p in posts]
        return PaginatedFeedResponse(posts=items, total=total, skip=skip, limit=limit)

    async def get_user_posts(self, target_user_id: str, viewer_id: str | None, skip: int = 0, limit: int = 20) -> PaginatedFeedResponse:
        """Lấy bài viết của một user cụ thể, có kiểm tra quyền xem."""
        is_own = viewer_id == target_user_id
        
        # Xác định các visibility mà viewer được phép xem
        allowed_visibility = ["public"]
        if is_own:
            allowed_visibility = ["public", "friends", "private"]
        elif viewer_id:
            friend_ids = await self.repo.get_friend_ids(target_user_id)
            if viewer_id in friend_ids:
                allowed_visibility = ["public", "friends"]
        
        where = {
            "userId": target_user_id,
            "postType": "feed",
            "visibility": {"in": allowed_visibility},
            "NOT": {"isHidden": True},
        }
        
        posts = await self.repo.db.post.find_many(
            where=where,
            include={"postImages": True, "user": True},
            order={"createdAt": "desc"},
            skip=skip,
            take=limit,
        )
        total = await self.repo.db.post.count(where=where)
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
                # Kiểm tra cài đặt thông báo của người nhận
                from app.modules.account.repository import AccountRepository
                from app.core.dependencies import db as prisma_db
                acc_repo = AccountRepository(prisma_db)
                ns = await acc_repo.get_notification_settings(post.userId)
                if not ns or ns.notifyLike:
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
            new_reply = {
                "user_info": user_info,
                "content": body.content,
                "is_hidden": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            updated_parent = await self.repo.add_reply_to_comment(
                body.parent_comment_id, 
                new_reply, 
                target_id=post_id, 
                target_type="post"
            )
            if not updated_parent:
                raise NotFoundException("Không tìm thấy bình luận gốc", "COMMENT_NOT_FOUND")

            # Thông báo cho chủ comment gốc
            parent_user_id = updated_parent.userInfo.get("id", "") if isinstance(updated_parent.userInfo, dict) else ""
            if self.notification_svc and parent_user_id and parent_user_id != user_id:
                # Kiểm tra cài đặt thông báo
                ns = await user_repo.db.notificationsetting.find_unique(where={"userId": parent_user_id})
                if not ns or ns.notifyReply:
                    await self.notification_svc.notify_reply(user.fullName, parent_user_id, post_id)

            return self._map_comment_to_response(updated_parent)
        else:
            # Create new top-level comment
            comment = await self.repo.create_comment(post_id, "post", user_info, body.content)

            # Thông báo cho chủ bài viết
            post = await self.repo.get_post_by_id(post_id, include_images=False)
            if self.notification_svc and post and post.userId != user_id:
                # Kiểm tra cài đặt thông báo
                ns = await prisma_db.notificationsetting.find_unique(where={"userId": post.userId})
                if not ns or ns.notifyComment:
                    await self.notification_svc.notify_comment(user.fullName, post.userId, post_id)

            return self._map_comment_to_response(comment)

    async def get_comments(self, post_id: str) -> List[CommentResponse]:
        comments = await self.repo.get_comments_by_target(post_id, "post")
        return [self._map_comment_to_response(c) for c in comments]

    # --- Friend management ---
    async def send_friend_request(self, user_id: str, target_user_id: str) -> dict:
        # Block Check
        block_exists = await self.repo.db.userblock.find_first(
            where={
                "OR": [
                    {"blockerId": user_id, "blockedId": target_user_id},
                    {"blockerId": target_user_id, "blockedId": user_id}
                ]
            }
        )
        if block_exists:
            raise ForbiddenException("Không thể gửi lời mời kết bạn (Người dùng đã bị chặn hoặc bạn bị chặn)", "USER_BLOCKED")

        # Privacy Check
        from app.modules.account.repository import AccountRepository
        from app.core.dependencies import db as prisma_db
        acc_repo = AccountRepository(prisma_db)
        privacy = await acc_repo.get_privacy_settings(target_user_id)
        
        if privacy:
            if privacy.whoCanFriendReq == "no_one":
                raise ForbiddenException("Người dùng này không nhận lời mời kết bạn mới", "FRIEND_REQUESTS_DISABLED")
                
            if privacy.whoCanFriendReq == "friends_of_friends":
                # Check if they have mutual friends
                target_friend_ids = await self.repo.get_friend_ids(target_user_id)
                sender_friend_ids = await self.repo.get_friend_ids(user_id)
                
                # Check intersection
                has_mutual = any(fid in target_friend_ids for fid in sender_friend_ids)
                if not has_mutual:
                    raise ForbiddenException("Người dùng này chỉ nhận lời mời kết bạn từ bạn của bạn bè", "MUTUAL_FRIENDS_ONLY")

        # Simple flow: create pending request
        await self.repo.send_friend_request(user_id, target_user_id)
        
        # Bắn thông báo (nếu người dùng cho phép trong cài đặt thông báo)
        if self.notification_svc:
            # Check target's notification settings
            notif_settings = await acc_repo.get_notification_settings(target_user_id)
            if not notif_settings or notif_settings.notifyFriendReq:
                actor_name = await self._get_user_name(user_id)
                await self.notification_svc.notify_friend_request(actor_name, target_user_id, user_id)
            
        return {"status": "đã gửi yêu cầu", "to": target_user_id}

    async def list_incoming_friend_requests(self, user_id: str) -> list:
        requests = await self.repo.get_incoming_friend_requests(user_id)
        return [
            {
                "from_id": r.requesterId,
                "full_name": r.requester.fullName if r.requester else "Người dùng",
                "avatar_url": r.requester.avatarUrl if r.requester else None,
                "created_at": r.createdAt
            }
            for r in requests
        ]

    async def accept_friend_request(self, user_id: str, requester_id: str) -> dict:
        updated = await self.repo.accept_friend_request(requester_id, user_id)
        if updated:
            from app.core.cache import invalidate_user_friend_cache
            await invalidate_user_friend_cache(user_id)
            await invalidate_user_friend_cache(requester_id)
            if self.notification_svc:
                actor_name = await self._get_user_name(user_id)
                await self.notification_svc.notify_system(
                    requester_id, 
                    "Yêu cầu kết bạn đã được chấp nhận", 
                    f"{actor_name} đã chấp nhận lời mời kết bạn của bạn."
                )
            return {"status": "đã chấp nhận", "from": requester_id, "to": user_id}
        
        raise NotFoundException("Không tìm thấy lời mời kết bạn hoặc lời mời không còn hiệu lực", "FRIEND_REQUEST_NOT_FOUND")

    async def reject_friend_request(self, user_id: str, requester_id: str) -> dict:
        updated = await self.repo.reject_friend_request(requester_id, user_id)
        if updated:
            return {"status": "đã từ chối", "from": requester_id, "to": user_id}
            
        raise NotFoundException("Không tìm thấy lời mời kết bạn hoặc lời mời không còn hiệu lực", "FRIEND_REQUEST_NOT_FOUND")

    async def unfriend(self, user_id: str, other_user_id: str) -> dict:
        ok = await self.repo.remove_friendship(user_id, other_user_id)
        from app.core.cache import invalidate_user_friend_cache
        await invalidate_user_friend_cache(user_id)
        await invalidate_user_friend_cache(other_user_id)
        return {"status": "đã hủy kết bạn" if ok else "không tìm thấy"}

    async def list_friends(self, user_id: str) -> list:
        ids = await self.repo.get_friend_ids(user_id)
        if not ids:
            return []
            
        from app.core.dependencies import get_account_repo
        from app.core.dependencies import db as prisma_db
        user_repo = get_account_repo(prisma_db)
        
        friends = await user_repo.get_users_by_ids(ids)
        return [
            {
                "id": f.id,
                "full_name": f.fullName,
                "avatar_url": f.avatarUrl
            }
            for f in friends
        ]

    # --- Block management ---
    async def block_user(self, user_id: str, target_user_id: str) -> dict:
        try:
            # Create block entry
            await self.repo.block_user(user_id, target_user_id)
        except Exception:
            # Already blocked or other error, proceed to unfriend anyway
            pass
        
        # Auto-unfriend to ensure privacy consistency
        await self.repo.remove_friendship(user_id, target_user_id)
        from app.core.cache import invalidate_user_friend_cache
        await invalidate_user_friend_cache(user_id)
        await invalidate_user_friend_cache(target_user_id)
        return {"status": "đã chặn", "blocked": target_user_id}

    async def list_blocked(self, user_id: str) -> list:
        blocked = await self.repo.get_blocked_users(user_id)
        return [
            {
                "blocked_id": b.blockedId,
                "full_name": b.blocked.fullName if b.blocked else "Người dùng"
            }
            for b in blocked
        ]

    async def unblock_user(self, user_id: str, target_user_id: str) -> dict:
        await self.repo.unblock_user(user_id, target_user_id)
        return {"status": "đã bỏ chặn", "unblocked": target_user_id}

    # --- Reports ---
    async def report_content(self, reporter_id: str, target_type: str, target_id: str, reason: str, description: str | None = None) -> dict:
        report = await self.repo.create_report(reporter_id, target_type, target_id, reason, description)
        return {"report_id": report.id, "status": report.status}

    # --- Media ---
    async def upload_post_image(self, user_id: str, content: bytes, filename: str) -> str:
        from app.utils.storage import upload_file
        # Upload vào folder posts/{user_id}
        url = await upload_file(content, filename, f"posts/{user_id}")
        return url

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
