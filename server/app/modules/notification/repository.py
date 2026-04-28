from typing import List, Optional

from prisma import Prisma
from prisma.models import Notification


class NotificationRepository:
    def __init__(self, db: Prisma):
        self.db = db

    async def create(self, data: dict) -> Notification:
        return await self.db.notification.create(data=data)

    async def get_by_id(self, notification_id: str) -> Optional[Notification]:
        return await self.db.notification.find_unique(where={"id": notification_id})

    async def get_by_user(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
        unread_only: bool = False,
    ) -> List[Notification]:
        where: dict = {"userId": user_id}
        if unread_only:
            where["isRead"] = False

        return await self.db.notification.find_many(
            where=where,
            order={"createdAt": "desc"},
            skip=skip,
            take=limit,
        )

    async def count_by_user(self, user_id: str) -> int:
        return await self.db.notification.count(where={"userId": user_id})

    async def count_unread(self, user_id: str) -> int:
        return await self.db.notification.count(
            where={"userId": user_id, "isRead": False}
        )

    async def mark_as_read(self, notification_id: str) -> Optional[Notification]:
        return await self.db.notification.update(
            where={"id": notification_id},
            data={"isRead": True},
        )

    async def mark_many_as_read(self, notification_ids: List[str], user_id: str) -> int:
        result = await self.db.notification.update_many(
            where={
                "id": {"in": notification_ids},
                "userId": user_id,
            },
            data={"isRead": True},
        )
        return result

    async def mark_all_as_read(self, user_id: str) -> int:
        result = await self.db.notification.update_many(
            where={"userId": user_id, "isRead": False},
            data={"isRead": True},
        )
        return result

    async def delete_notification(self, notification_id: str) -> None:
        await self.db.notification.delete(where={"id": notification_id})

    async def delete_all_by_user(self, user_id: str) -> int:
        result = await self.db.notification.delete_many(
            where={"userId": user_id}
        )
        return result
