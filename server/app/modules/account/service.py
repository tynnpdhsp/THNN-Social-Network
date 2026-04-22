import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

from prisma.models import User

from app.core.config import get_settings
from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
    TooManyRequestsException,
    UnauthorizedException,
    LockedAccountException,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.redis import get_redis
from app.modules.account.repository import AccountRepository
from app.modules.account.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    OrderHistoryItem,
    OrderHistoryResponse,
    ProfileResponse,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SendOtpRequest,
    TokenResponse,
    UpdateNotificationSettingsRequest,
    UpdatePrivacySettingsRequest,
    UpdateProfileRequest,
    VerifyOtpRequest,
)
from app.utils.email import (
    cache_otp,
    delete_cached_otp,
    get_cached_otp,
    increment_otp_attempts,
    send_otp_email,
)
from app.utils.otp import generate_otp

logger = logging.getLogger(__name__)
settings = get_settings()


class AccountService:
    def __init__(self, repo: AccountRepository):
        self.repo = repo

    # ─── Register ──────────────────────────────────────────────────────────

    async def send_register_otp(self, body: SendOtpRequest) -> str:
        existing = await self.repo.get_user_by_email(body.email)
        if existing and existing.deletedAt is None:
            raise ConflictException("Email already registered", "EMAIL_EXISTS")

        code = generate_otp(settings.OTP_LENGTH)
        await self.repo.invalidate_otps(body.email, body.purpose)
        await self.repo.create_otp(
            data={
                "email": body.email,
                "code": code,
                "purpose": body.purpose,
                "attempts": 0,
                "maxAttempts": settings.OTP_MAX_ATTEMPTS,
                "expiresAt": datetime.now(timezone.utc) + __import__("datetime").timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
                "isUsed": False,
            }
        )
        await cache_otp(body.email, body.purpose, code)
        await send_otp_email(body.email, code, body.purpose)
        return "OTP sent to your email"

    async def register(self, body: RegisterRequest) -> TokenResponse:
        existing = await self.repo.get_user_by_email(body.email)
        if existing and existing.deletedAt is None:
            raise ConflictException("Email already registered", "EMAIL_EXISTS")

        cached = await get_cached_otp(body.email, "register")
        if cached is None:
            raise BadRequestException("OTP not found or expired. Please request a new one.", "OTP_EXPIRED")

        role = await self.repo.get_role_by_name("student")
        if role is None:
            raise NotFoundException("Default role not found", "ROLE_NOT_FOUND")

        user = await self.repo.create_user(
            data={
                "email": body.email,
                "phoneNumber": body.phone_number,
                "passwordHash": hash_password(body.password),
                "fullName": body.full_name,
                "roleId": role.id,
                "emailVerified": True,
            }
        )

        await delete_cached_otp(body.email, "register")
        await self.repo.invalidate_otps(body.email, "register")

        return await self._create_tokens(user.id)

    async def verify_otp(self, body: VerifyOtpRequest) -> str:
        cached = await get_cached_otp(body.email, body.purpose)
        if cached is None:
            raise BadRequestException("OTP not found or expired", "OTP_EXPIRED")

        if cached["attempts"] >= cached["max_attempts"]:
            await delete_cached_otp(body.email, body.purpose)
            raise TooManyRequestsException("OTP max attempts exceeded. Please request a new one.", "OTP_MAX_ATTEMPTS")

        if cached["code"] != body.code:
            attempts = await increment_otp_attempts(body.email, body.purpose)
            remaining = cached["max_attempts"] - attempts
            raise BadRequestException(
                f"Invalid OTP. {remaining} attempts remaining.", "INVALID_OTP"
            )

        await delete_cached_otp(body.email, body.purpose)
        return "OTP verified successfully"

    # ─── Login ─────────────────────────────────────────────────────────────

    async def login(self, body: LoginRequest, ip_address: str) -> TokenResponse:
        r = await get_redis()

        ip_key = f"rate:login:ip:{ip_address}"
        ip_count = await r.get(ip_key)
        if ip_count and int(ip_count) >= settings.LOGIN_RATE_LIMIT_IP:
            raise TooManyRequestsException("Too many login attempts from this IP", "IP_RATE_LIMITED")

        email_key = f"rate:login:email:{body.email}"
        email_count = await r.get(email_key)
        if email_count and int(email_count) >= settings.LOGIN_RATE_LIMIT_EMAIL:
            raise TooManyRequestsException("Too many login attempts for this email", "EMAIL_RATE_LIMITED")

        user = await self.repo.get_user_by_email(body.email)
        if user is None or user.deletedAt is not None:
            await self._increment_rate_limit(r, ip_key, email_key)
            raise UnauthorizedException("Invalid email or password", "INVALID_CREDENTIALS")

        if user.isLocked:
            raise LockedAccountException(user.lockReason or "Account is locked", "ACCOUNT_LOCKED")

        if not verify_password(body.password, user.passwordHash):
            await self._increment_rate_limit(r, ip_key, email_key)
            raise UnauthorizedException("Invalid email or password", "INVALID_CREDENTIALS")

        await r.delete(ip_key, email_key)

        await self.repo.update_user(user.id, {"lastLoginAt": datetime.now(timezone.utc)})

        tokens = await self._create_tokens(user.id)

        session_key = f"auth:session:{user.id}"
        import json
        session_data = json.dumps({
            "user_id": user.id,
            "email": user.email,
            "full_name": user.fullName,
            "role": user.roleId,
            "avatar_url": user.avatarUrl or "",
            "login_at": datetime.now(timezone.utc).isoformat(),
        })
        await r.set(session_key, session_data, ex=86400)

        return tokens

    # ─── Logout ─────────────────────────────────────────────────────────────

    async def logout(self, user_id: str, refresh_token: Optional[str] = None) -> str:
        r = await get_redis()
        await r.delete(f"auth:session:{user_id}")

        if refresh_token:
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            rt = await self.repo.get_refresh_token_by_hash(token_hash)
            if rt and rt.revokedAt is None:
                await self.repo.revoke_refresh_token(rt.id)
                remaining = (rt.expiresAt - datetime.now(timezone.utc)).total_seconds()
                if remaining > 0:
                    await r.set(f"auth:blacklist:{token_hash}", "revoked", ex=int(remaining))

        return "Logged out successfully"

    # ─── Refresh Token ─────────────────────────────────────────────────────

    async def refresh_access_token(self, body: RefreshTokenRequest) -> TokenResponse:
        payload = decode_token(body.refresh_token)
        if payload is None or payload.get("type") != "refresh":
            raise UnauthorizedException("Invalid refresh token", "INVALID_REFRESH_TOKEN")

        token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()
        r = await get_redis()
        blacklisted = await r.exists(f"auth:blacklist:{token_hash}")
        if blacklisted:
            raise UnauthorizedException("Refresh token has been revoked", "TOKEN_REVOKED")

        rt = await self.repo.get_refresh_token_by_hash(token_hash)
        if rt is None:
            raise UnauthorizedException("Refresh token not found", "TOKEN_NOT_FOUND")
        if rt.revokedAt is not None:
            raise UnauthorizedException("Refresh token has been revoked", "TOKEN_REVOKED")
        if rt.expiresAt < datetime.now(timezone.utc):
            raise UnauthorizedException("Refresh token expired", "TOKEN_EXPIRED")

        user = await self.repo.get_user_by_id(rt.userId)
        if user is None or user.isLocked or user.deletedAt is not None:
            raise UnauthorizedException("User account is inactive", "ACCOUNT_INACTIVE")

        await self.repo.revoke_refresh_token(rt.id)
        remaining = (rt.expiresAt - datetime.now(timezone.utc)).total_seconds()
        if remaining > 0:
            await r.set(f"auth:blacklist:{token_hash}", "revoked", ex=int(remaining))

        return await self._create_tokens(user.id)

    # ─── Forgot Password ───────────────────────────────────────────────────

    async def forgot_password(self, body: SendOtpRequest) -> str:
        user = await self.repo.get_user_by_email(body.email)
        if user is None or user.deletedAt is not None:
            return "If the email exists, an OTP has been sent"

        code = generate_otp(settings.OTP_LENGTH)
        await self.repo.invalidate_otps(body.email, body.purpose)
        await self.repo.create_otp(
            data={
                "email": body.email,
                "code": code,
                "purpose": body.purpose,
                "attempts": 0,
                "maxAttempts": settings.OTP_MAX_ATTEMPTS,
                "expiresAt": datetime.now(timezone.utc) + __import__("datetime").timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
                "isUsed": False,
            }
        )
        await cache_otp(body.email, body.purpose, code)
        await send_otp_email(body.email, code, body.purpose)
        return "If the email exists, an OTP has been sent"

    async def reset_password(self, body: ResetPasswordRequest) -> str:
        cached = await get_cached_otp(body.email, "reset_password")
        if cached is None:
            raise BadRequestException("OTP not found or expired", "OTP_EXPIRED")

        if cached["attempts"] >= cached["max_attempts"]:
            await delete_cached_otp(body.email, "reset_password")
            raise TooManyRequestsException("OTP max attempts exceeded", "OTP_MAX_ATTEMPTS")

        if cached["code"] != body.code:
            await increment_otp_attempts(body.email, "reset_password")
            raise BadRequestException("Invalid OTP", "INVALID_OTP")

        user = await self.repo.get_user_by_email(body.email)
        if user is None:
            raise NotFoundException("User not found", "USER_NOT_FOUND")

        await self.repo.update_user(user.id, {"passwordHash": hash_password(body.new_password)})
        await self.repo.revoke_all_user_tokens(user.id)
        await delete_cached_otp(body.email, "reset_password")
        await self.repo.invalidate_otps(body.email, "reset_password")

        r = await get_redis()
        await r.delete(f"auth:session:{user.id}")

        return "Password reset successfully"

    # ─── Change Password ───────────────────────────────────────────────────

    async def change_password(self, user_id: str, body: ChangePasswordRequest) -> str:
        user = await self.repo.get_user_by_id(user_id)
        if user is None:
            raise NotFoundException("User not found", "USER_NOT_FOUND")

        if not verify_password(body.current_password, user.passwordHash):
            raise BadRequestException("Current password is incorrect", "WRONG_PASSWORD")

        await self.repo.update_user(user.id, {"passwordHash": hash_password(body.new_password)})
        await self.repo.revoke_all_user_tokens(user_id)

        r = await get_redis()
        await r.delete(f"auth:session:{user_id}")

        return "Password changed successfully. Please login again."

    # ─── Profile ───────────────────────────────────────────────────────────

    async def get_profile(self, user_id: str) -> ProfileResponse:
        user = await self.repo.get_user_by_id(user_id)
        if user is None:
            raise NotFoundException("User not found", "USER_NOT_FOUND")

        role = await self.repo.db.role.find_unique(where={"id": user.roleId})

        return ProfileResponse(
            id=user.id,
            email=user.email,
            full_name=user.fullName,
            phone_number=user.phoneNumber,
            bio=user.bio,
            avatar_url=user.avatarUrl,
            cover_url=user.coverUrl,
            role=role.role if role else "unknown",
            email_verified=user.emailVerified,
            created_at=user.createdAt,
        )

    async def update_profile(self, user_id: str, body: UpdateProfileRequest) -> ProfileResponse:
        data = body.model_dump(exclude_none=True)
        if not data:
            raise BadRequestException("No fields to update", "EMPTY_UPDATE")

        field_map = {
            "full_name": "fullName",
            "phone_number": "phoneNumber",
        }
        prisma_data = {}
        for k, v in data.items():
            prisma_key = field_map.get(k, k)
            prisma_data[prisma_key] = v

        user = await self.repo.update_user(user_id, prisma_data)

        r = await get_redis()
        await r.delete(f"user:profile:{user_id}")
        await r.delete(f"auth:session:{user_id}")

        return await self.get_profile(user_id)

    async def update_avatar(self, user_id: str, avatar_url: str) -> ProfileResponse:
        await self.repo.update_user(user_id, {"avatarUrl": avatar_url})
        r = await get_redis()
        await r.delete(f"user:profile:{user_id}")
        await r.delete(f"auth:session:{user_id}")
        return await self.get_profile(user_id)

    async def update_cover(self, user_id: str, cover_url: str) -> ProfileResponse:
        await self.repo.update_user(user_id, {"coverUrl": cover_url})
        r = await get_redis()
        await r.delete(f"user:profile:{user_id}")
        await r.delete(f"auth:session:{user_id}")
        return await self.get_profile(user_id)

    # ─── Privacy Settings ──────────────────────────────────────────────────

    async def get_privacy_settings(self, user_id: str):
        ps = await self.repo.get_privacy_settings(user_id)
        if ps is None:
            ps = await self.repo.create_privacy_settings(
                data={
                    "userId": user_id,
                    "whoCanSeePosts": "everyone",
                    "whoCanMessage": "everyone",
                    "whoCanFriendReq": "everyone",
                }
            )
        from app.modules.account.schemas import PrivacySettingsResponse
        return PrivacySettingsResponse(
            who_can_see_posts=ps.whoCanSeePosts,
            who_can_message=ps.whoCanMessage,
            who_can_friend_req=ps.whoCanFriendReq,
        )

    async def update_privacy_settings(self, user_id: str, body: UpdatePrivacySettingsRequest):
        data = body.model_dump(exclude_none=True)
        field_map = {"who_can_friend_req": "whoCanFriendReq"}
        prisma_data = {}
        for k, v in data.items():
            prisma_data[field_map.get(k, k)] = v

        ps = await self.repo.update_privacy_settings(user_id, prisma_data)
        r = await get_redis()
        await r.delete(f"user:privacy:{user_id}")

        from app.modules.account.schemas import PrivacySettingsResponse
        return PrivacySettingsResponse(
            who_can_see_posts=ps.whoCanSeePosts,
            who_can_message=ps.whoCanMessage,
            who_can_friend_req=ps.whoCanFriendReq,
        )

    # ─── Notification Settings ─────────────────────────────────────────────

    async def get_notification_settings(self, user_id: str):
        ns = await self.repo.get_notification_settings(user_id)
        if ns is None:
            ns = await self.repo.create_notification_settings(
                data={
                    "userId": user_id,
                    "notifyLike": True,
                    "notifyComment": True,
                    "notifyReply": True,
                    "notifyFriendReq": True,
                    "notifyMessage": True,
                    "notifySchedule": True,
                }
            )
        from app.modules.account.schemas import NotificationSettingsResponse
        return NotificationSettingsResponse(
            notify_like=ns.notifyLike,
            notify_comment=ns.notifyComment,
            notify_reply=ns.notifyReply,
            notify_friend_req=ns.notifyFriendReq,
            notify_message=ns.notifyMessage,
            notify_schedule=ns.notifySchedule,
        )

    async def update_notification_settings(self, user_id: str, body: UpdateNotificationSettingsRequest):
        data = body.model_dump(exclude_none=True)
        field_map = {"notify_friend_req": "notifyFriendReq"}
        prisma_data = {}
        for k, v in data.items():
            prisma_data[field_map.get(k, k)] = v

        ns = await self.repo.update_notification_settings(user_id, prisma_data)
        r = await get_redis()
        await r.delete(f"user:notif_settings:{user_id}")

        from app.modules.account.schemas import NotificationSettingsResponse
        return NotificationSettingsResponse(
            notify_like=ns.notifyLike,
            notify_comment=ns.notifyComment,
            notify_reply=ns.notifyReply,
            notify_friend_req=ns.notifyFriendReq,
            notify_message=ns.notifyMessage,
            notify_schedule=ns.notifySchedule,
        )

    # ─── Order History ─────────────────────────────────────────────────────

    async def get_order_history(self, user_id: str, skip: int = 0, limit: int = 20) -> OrderHistoryResponse:
        orders = await self.repo.get_user_orders(user_id, skip, limit)
        total = await self.repo.count_user_orders(user_id)

        items = []
        for o in orders:
            item_title = o.item.title if hasattr(o, "item") and o.item else "Unknown"
            items.append(OrderHistoryItem(
                id=o.id,
                item_title=item_title,
                amount=o.amount,
                status=o.status,
                paid_at=o.paidAt,
                created_at=o.createdAt,
            ))

        return OrderHistoryResponse(orders=items, total=total)

    # ─── Helpers ────────────────────────────────────────────────────────────

    async def _create_tokens(self, user_id: str) -> TokenResponse:
        access_token = create_access_token(user_id)
        refresh_token = create_refresh_token(user_id)
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()

        await self.repo.create_refresh_token(
            data={
                "userId": user_id,
                "tokenHash": token_hash,
                "expiresAt": datetime.now(timezone.utc) + __import__("datetime").timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            }
        )

        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    async def _increment_rate_limit(self, r, ip_key: str, email_key: str) -> None:
        ip_count = await r.incr(ip_key)
        if ip_count == 1:
            await r.expire(ip_key, settings.LOGIN_RATE_LIMIT_IP_WINDOW_SECONDS)

        email_count = await r.incr(email_key)
        if email_count == 1:
            await r.expire(email_key, settings.LOGIN_RATE_LIMIT_EMAIL_WINDOW_SECONDS)
