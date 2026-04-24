from typing import List, Optional
from datetime import datetime, timezone
from prisma import Prisma
from prisma.models import Post, PostImage, Like, Comment
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

    async def get_posts_feed(self, skip: int = 0, limit: int = 20, post_type: str = "feed") -> List[Post]:
        return await self.db.post.find_many(
            where={
                "postType": post_type,
                "isHidden": False,
                "deletedAt": None
            },
            include={"postImages": True, "user": True},
            order={"createdAt": "desc"},
            skip=skip,
            take=limit
        )

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
