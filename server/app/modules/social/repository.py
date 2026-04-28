from typing import List, Optional
from datetime import datetime, timezone
from prisma import Prisma
from prisma.models import Post, PostImage, Like, Comment, Friendship, BoardTag
from prisma.types import PostCreateInput, PostUpdateInput
from prisma.errors import RecordNotFoundError
from app.core.cache import increment_post_like, increment_post_comment

class SocialRepository:
    def __init__(self, db: Prisma):
        self.db = db

    # --- Posts ---
    async def create_post(self, data: PostCreateInput) -> Post:
        return await self.db.post.create(data=data)

    async def get_post_by_id(self, post_id: str, include_images: bool = True) -> Optional[Post]:
        include = {"postImages": True} if include_images else None
        return await self.db.post.find_unique(
            where={"id": post_id},
            include=include
        )

    async def get_posts_feed(
        self, skip: int = 0, limit: int = 20,
        post_type: str = "feed",
        friend_ids: list[str] | None = None,
        viewer_id: str | None = None,
    ) -> List[Post]:
        """Get feed with privacy filtering.
        
        Rules:
        - public: everyone sees
        - friends: only friends + post owner see
        - private: only post owner sees
        """
        if viewer_id and friend_ids is not None:
            # Logged-in user sees: public + own posts + friends' posts (if visibility=friends)
            where = {
                "postType": post_type,
                "OR": [
                    {"visibility": "public"},
                    {"userId": viewer_id},
                    {"visibility": "friends", "userId": {"in": friend_ids}},
                ],
            }
        else:
            # Anonymous: public only
            where = {
                "postType": post_type,
                "visibility": "public",
            }

        return await self.db.post.find_many(
            where=where,
            include={"postImages": True, "user": True},
            order={"createdAt": "desc"},
            skip=skip,
            take=limit,
        )

    async def count_posts_feed(
        self, post_type: str = "feed",
        friend_ids: list[str] | None = None,
        viewer_id: str | None = None,
    ) -> int:
        if viewer_id and friend_ids is not None:
            where = {
                "postType": post_type,
                "OR": [
                    {"visibility": "public"},
                    {"userId": viewer_id},
                    {"visibility": "friends", "userId": {"in": friend_ids}},
                ],
            }
        else:
            where = {
                "postType": post_type,
                "visibility": "public",
            }
        return await self.db.post.count(where=where)

    async def update_post(self, post_id: str, data: PostUpdateInput) -> Optional[Post]:
        try:
            return await self.db.post.update(where={"id": post_id}, data=data)
        except RecordNotFoundError:
            return None

    async def soft_delete_post(self, post_id: str) -> Optional[Post]:
        try:
            return await self.db.post.update(
                where={"id": post_id},
                data={"deletedAt": datetime.now(timezone.utc)}
            )
        except RecordNotFoundError:
            return None

    async def create_post_images(self, post_id: str, images: List[dict]):
        if not images:
            return
        await self.db.postimage.create_many(
            data=[
                {
                    "postId": post_id,
                    "imageUrl": img["image_url"],
                    "displayOrder": img.get("display_order", 0)
                }
                for img in images
            ]
        )

    # --- Likes ---
    async def get_like(self, target_id: str, target_type: str, user_id: str) -> Optional[Like]:
        return await self.db.like.find_unique(
            where={
                "targetId_targetType_userId": {
                    "targetId": target_id,
                    "targetType": target_type,
                    "userId": user_id
                }
            }
        )

    async def create_like(self, target_id: str, target_type: str, user_id: str) -> Like:
        async with self.db.tx() as tx:
            like = await tx.like.create(data={
                "targetId": target_id,
                "targetType": target_type,
                "userId": user_id
            })
            if target_type == "post":
                await tx.post.update(
                    where={"id": target_id},
                    data={"likeCount": {"increment": 1}}
                )
        if target_type == "post":
            await increment_post_like(target_id, 1)
        return like

    async def delete_like(self, like_id: str, target_id: str, target_type: str) -> None:
        async with self.db.tx() as tx:
            await tx.like.delete(where={"id": like_id})
            if target_type == "post":
                await tx.post.update(
                    where={"id": target_id},
                    data={"likeCount": {"decrement": 1}}
                )
        if target_type == "post":
            await increment_post_like(target_id, -1)

    # --- Comments ---
    async def create_comment(self, target_id: str, target_type: str, user_info: dict, content: str) -> Comment:
        from prisma import Json
        async with self.db.tx() as tx:
            comment = await tx.comment.create(data={
                "targetId": target_id,
                "targetType": target_type,
                "userInfo": Json(user_info),
                "content": content,
                "replies": Json([])
            })
            if target_type == "post":
                await tx.post.update(
                    where={"id": target_id},
                    data={"commentCount": {"increment": 1}}
                )
        if target_type == "post":
            await increment_post_comment(target_id, 1)
        return comment

    async def get_comment_by_id(self, comment_id: str) -> Optional[Comment]:
        return await self.db.comment.find_unique(where={"id": comment_id})

    async def update_comment_replies(self, comment_id: str, replies_json: str) -> Comment:
        from prisma import Json
        import json
        return await self.db.comment.update(
            where={"id": comment_id},
            data={"replies": Json(json.loads(replies_json))}
        )

    async def get_comments_by_target(self, target_id: str, target_type: str) -> List[Comment]:
        return await self.db.comment.find_many(
            where={"targetId": target_id, "targetType": target_type},
            order={"createdAt": "desc"}
        )

    # --- Friendship Queries ---
    async def get_friend_ids(self, user_id: str) -> List[str]:
        """Get list of accepted friend user IDs."""
        friendships = await self.db.friendship.find_many(
            where={
                "status": "accepted",
                "OR": [
                    {"requesterId": user_id},
                    {"receiverId": user_id},
                ],
            }
        )
        ids = []
        for f in friendships:
            ids.append(f.receiverId if f.requesterId == user_id else f.requesterId)
        return ids

    # --- Friend Requests (UC-08) ---
    async def send_friend_request(self, requester_id: str, receiver_id: str) -> " Friendship":
        from prisma.errors import RecordNotFoundError
        # Create a pending friendship request
        return await self.db.friendship.create(data={
            "requesterId": requester_id,
            "receiverId": receiver_id,
            "status": "pending",
        })

    async def accept_friend_request(self, requester_id: str, receiver_id: str) -> Optional["Friendship"]:
        # Update existing pending request to accepted
        try:
            return await self.db.friendship.update(
                where={"requesterId_receiverId": {"requesterId": requester_id, "receiverId": receiver_id}},
                data={"status": "accepted"},
            )
        except Exception:
            return None

    async def reject_friend_request(self, requester_id: str, receiver_id: str) -> Optional["Friendship"]:
        try:
            return await self.db.friendship.update(
                where={"requesterId_receiverId": {"requesterId": requester_id, "receiverId": receiver_id}},
                data={"status": "rejected"},
            )
        except Exception:
            return None

    async def remove_friendship(self, user_a_id: str, user_b_id: str) -> bool:
        # Try delete in both directions using the unique compound key
        try:
            await self.db.friendship.delete(
                where={"requesterId_receiverId": {"requesterId": user_a_id, "receiverId": user_b_id}}
            )
        except Exception:
            try:
                await self.db.friendship.delete(
                    where={"requesterId_receiverId": {"requesterId": user_b_id, "receiverId": user_a_id}}
                )
            except Exception:
                return False
        return True

    async def get_incoming_friend_requests(self, user_id: str) -> List["Friendship"]:
        return await self.db.friendship.find_many(
            where={"receiverId": user_id, "status": "pending"},
            include={"requester": True},
        )

    # --- Block & Reports helpers ---
    async def block_user(self, blocker_id: str, blocked_id: str):
        return await self.db.userblock.create(data={
            "blockerId": blocker_id,
            "blockedId": blocked_id,
        })

    async def get_blocked_users(self, user_id: str) -> List["UserBlock"]:
        return await self.db.userblock.find_many(where={"blockerId": user_id})

    async def unblock_user(self, blocker_id: str, blocked_id: str):
        try:
            await self.db.userblock.delete(where={"blockerId_blockedId": {"blockerId": blocker_id, "blockedId": blocked_id}})
        except Exception:
            # Try reverse just in case (though direction is fixed)
            try:
                await self.db.userblock.delete(where={"blockerId_blockedId": {"blockerId": blocked_id, "blockedId": blocker_id}})
            except Exception:
                pass

    async def create_report(self, reporter_id: str, target_type: str, target_id: str, reason: str, description: str | None):
        return await self.db.report.create(data={
            "reporterId": reporter_id,
            "targetType": target_type,
            "targetId": target_id,
            "reason": reason,
            "description": description,
            "status": "pending",
        })

    # --- Board Queries ---
    async def get_board_tags(self) -> list:
        return await self.db.boardtag.find_many(order={"name": "asc"})

    async def get_board_posts(
        self, skip: int = 0, limit: int = 20,
        tag_id: str | None = None,
    ) -> List[Post]:
        where: dict = {
            "postType": "board",
        }
        if tag_id:
            where["boardTagId"] = tag_id

        return await self.db.post.find_many(
            where=where,
            include={"postImages": True, "user": True, "boardTag": True},
            order={"createdAt": "desc"},
            skip=skip,
            take=limit,
        )

    async def count_board_posts(self, tag_id: str | None = None) -> int:
        where: dict = {
            "postType": "board",
        }
        if tag_id:
            where["boardTagId"] = tag_id
        return await self.db.post.count(where=where)
