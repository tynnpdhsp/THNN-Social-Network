from datetime import datetime, timezone
from typing import Optional

from prisma import Prisma
from prisma.models import User, OtpCode, RefreshToken, PrivacySetting, NotificationSetting, Order
from prisma.types import (
    UserWhereInput,
    UserCreateInput,
    UserUpdateInput,
    OtpCodeCreateInput,
    OtpCodeUpdateInput,
    RefreshTokenCreateInput,
    RefreshTokenUpdateInput,
    PrivacySettingCreateInput,
    PrivacySettingUpdateInput,
    NotificationSettingCreateInput,
    NotificationSettingUpdateInput,
)
import logging

logger = logging.getLogger(__name__)

class AccountRepository:
    def __init__(self, db: Prisma):
        self.db = db

    # ─── User ──────────────────────────────────────────────────────────────

    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        return await self.db.user.find_unique(where={"id": user_id})

    async def get_users_by_ids(self, user_ids: list[str]) -> list[User]:
        return await self.db.user.find_many(where={"id": {"in": user_ids}})

    async def get_user_by_email(self, email: str) -> Optional[User]:
        return await self.db.user.find_unique(where={"email": email})

    async def search_users(self, query: str, limit: int = 10) -> list[User]:
        clean_query = query.strip()
        logger.debug(f"REPO_DEBUG: Searching for '{clean_query}'")

        # Prisma MongoDB bug: OR + mode:"insensitive" returns 0 results.
        # Workaround: run two separate queries and merge.
        # NOTE: Do NOT use "deletedAt": None — Prisma MongoDB treats
        # missing fields differently from null, causing 0 results.
        by_name = await self.db.user.find_many(
            where={"fullName": {"contains": clean_query, "mode": "insensitive"}},
            include={"roleRef": True},
            take=limit,
        )
        by_email = await self.db.user.find_many(
            where={"email": {"contains": clean_query, "mode": "insensitive"}},
            include={"roleRef": True},
            take=limit,
        )

        # Merge and deduplicate
        seen_ids = set()
        users = []
        for u in by_name + by_email:
            if u.id not in seen_ids:
                seen_ids.add(u.id)
                users.append(u)
            if len(users) >= limit:
                break

        logger.debug(f"REPO_DEBUG: Found {len(users)} users in DB")
        return users

    async def create_user(self, data: UserCreateInput) -> User:
        return await self.db.user.create(data=data)

    async def update_user(self, user_id: str, data: UserUpdateInput) -> User:
        return await self.db.user.update(where={"id": user_id}, data=data)

    async def soft_delete_user(self, user_id: str) -> User:
        return await self.db.user.update(
            where={"id": user_id},
            data={"deletedAt": datetime.now(timezone.utc)},
        )

    # ─── OTP ───────────────────────────────────────────────────────────────

    async def create_otp(self, data: OtpCodeCreateInput) -> OtpCode:
        return await self.db.otpcode.create(data=data)

    async def get_otp_by_email_purpose(self, email: str, purpose: str) -> Optional[OtpCode]:
        return await self.db.otpcode.find_first(
            where={"email": email, "purpose": purpose, "isUsed": False},
            order={"createdAt": "desc"},
        )

    async def update_otp(self, otp_id: str, data: OtpCodeUpdateInput) -> OtpCode:
        return await self.db.otpcode.update(where={"id": otp_id}, data=data)

    async def invalidate_otps(self, email: str, purpose: str) -> None:
        await self.db.otpcode.update_many(
            where={"email": email, "purpose": purpose, "isUsed": False},
            data={"isUsed": True},
        )

    # ─── Refresh Token ─────────────────────────────────────────────────────

    async def create_refresh_token(self, data: RefreshTokenCreateInput) -> RefreshToken:
        return await self.db.refreshtoken.create(data=data)

    async def get_refresh_token_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        return await self.db.refreshtoken.find_unique(where={"tokenHash": token_hash})

    async def revoke_refresh_token(self, token_id: str) -> RefreshToken:
        return await self.db.refreshtoken.update(
            where={"id": token_id},
            data={"revokedAt": datetime.now(timezone.utc)},
        )

    async def revoke_all_user_tokens(self, user_id: str) -> None:
        await self.db.refreshtoken.update_many(
            where={"userId": user_id, "revokedAt": None},
            data={"revokedAt": datetime.now(timezone.utc)},
        )

    # ─── Privacy Settings ──────────────────────────────────────────────────

    async def get_privacy_settings(self, user_id: str) -> Optional[PrivacySetting]:
        return await self.db.privacysetting.find_unique(where={"userId": user_id})

    async def create_privacy_settings(self, data: PrivacySettingCreateInput) -> PrivacySetting:
        return await self.db.privacysetting.create(data=data)

    async def update_privacy_settings(self, user_id: str, data: PrivacySettingUpdateInput) -> PrivacySetting:
        return await self.db.privacysetting.update(where={"userId": user_id}, data=data)

    # ─── Notification Settings ─────────────────────────────────────────────

    async def get_notification_settings(self, user_id: str) -> Optional[NotificationSetting]:
        return await self.db.notificationsetting.find_unique(where={"userId": user_id})

    async def create_notification_settings(self, data: NotificationSettingCreateInput) -> NotificationSetting:
        return await self.db.notificationsetting.create(data=data)

    async def update_notification_settings(self, user_id: str, data: NotificationSettingUpdateInput) -> NotificationSetting:
        return await self.db.notificationsetting.update(where={"userId": user_id}, data=data)

    # ─── Order History ─────────────────────────────────────────────────────

    async def get_user_orders(self, user_id: str, skip: int = 0, limit: int = 20) -> list[Order]:
        return await self.db.order.find_many(
            where={"buyerId": user_id},
            include={"item": {"select": {"title": True}}},
            order={"createdAt": "desc"},
            skip=skip,
            take=limit,
        )

    async def count_user_orders(self, user_id: str) -> int:
        return await self.db.order.count(where={"buyerId": user_id})

    # ─── Role ──────────────────────────────────────────────────────────────

    async def get_role_by_name(self, role_name: str):
        return await self.db.role.find_first(where={"role": role_name})
