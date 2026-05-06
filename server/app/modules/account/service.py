import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

from prisma.models import User

from app.core.config import get_settings
from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
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

    async def resend_verification_otp(self, body: SendOtpRequest) -> str:
        user = await self.repo.get_user_by_email(body.email)
        if user is None or user.deletedAt is not None:
            raise BadRequestException("Không tìm thấy tài khoản.", "INVALID_REQUEST")
        
        if user.emailVerified:
            raise BadRequestException("Tài khoản đã được xác thực.", "ALREADY_VERIFIED")

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
        return "Mã OTP xác thực đã được gửi lại vào email của bạn"

    async def register(self, body: RegisterRequest) -> str:
        existing = await self.repo.get_user_by_email(body.email)
        if existing and existing.deletedAt is None:
            if not existing.emailVerified:
                raise ConflictException("Email đã đăng ký nhưng chưa xác thực. Vui lòng xác thực hoặc yêu cầu mã OTP mới.", "UNVERIFIED_EMAIL_EXISTS")
            raise ConflictException("Email đã được đăng ký", "EMAIL_EXISTS")

        role = await self.repo.get_role_by_name("student")
        if role is None:
            raise NotFoundException("Không tìm thấy vai trò mặc định", "ROLE_NOT_FOUND")

        user = await self.repo.create_user(
            data={
                "email": body.email,
                "phoneNumber": body.phone_number,
                "passwordHash": hash_password(body.password),
                "fullName": body.full_name,
                "roleId": role.id,
                "emailVerified": False,
            }
        )

        code = generate_otp(settings.OTP_LENGTH)
        await self.repo.invalidate_otps(body.email, "register")
        await self.repo.create_otp(
            data={
                "email": body.email,
                "code": code,
                "purpose": "register",
                "attempts": 0,
                "maxAttempts": settings.OTP_MAX_ATTEMPTS,
                "expiresAt": datetime.now(timezone.utc) + __import__("datetime").timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
                "isUsed": False,
            }
        )
        await cache_otp(body.email, "register", code)
        await send_otp_email(body.email, code, "register")

        return "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản của bạn."

    async def verify_otp(self, body: VerifyOtpRequest) -> str:
        cached = await get_cached_otp(body.email, body.purpose)
        if cached is None:
            raise BadRequestException("Mã OTP không tồn tại hoặc đã hết hạn", "OTP_EXPIRED")

        if cached["attempts"] >= cached["max_attempts"]:
            await delete_cached_otp(body.email, body.purpose)
            raise TooManyRequestsException("Đã vượt quá số lần nhập OTP tối đa. Vui lòng yêu cầu mã mới.", "OTP_MAX_ATTEMPTS")

        if cached["code"] != body.code:
            attempts = await increment_otp_attempts(body.email, body.purpose)
            remaining = cached["max_attempts"] - attempts
            raise BadRequestException(
                f"Mã OTP không hợp lệ. Còn lại {remaining} lần thử.", "INVALID_OTP"
            )

        await delete_cached_otp(body.email, body.purpose)
        
        if body.purpose == "register":
            user = await self.repo.get_user_by_email(body.email)
            if user:
                await self.repo.update_user(user.id, {"emailVerified": True})

        return "Xác thực mã OTP thành công"

    # ─── Login ─────────────────────────────────────────────────────────────

    async def login(self, body: LoginRequest, ip_address: str) -> TokenResponse:
        r = await get_redis()

        ip_key = f"rate:login:ip:{ip_address}"
        ip_count = await r.get(ip_key)
        if ip_count and int(ip_count) >= settings.LOGIN_RATE_LIMIT_IP:
            raise TooManyRequestsException("Quá nhiều lần thử đăng nhập từ địa chỉ IP này", "IP_RATE_LIMITED")

        email_key = f"rate:login:email:{body.email}"
        email_count = await r.get(email_key)
        if email_count and int(email_count) >= settings.LOGIN_RATE_LIMIT_EMAIL:
            raise TooManyRequestsException("Quá nhiều lần thử đăng nhập cho email này", "EMAIL_RATE_LIMITED")

        user = await self.repo.get_user_by_email(body.email)
        if user is None or user.deletedAt is not None:
            await self._increment_rate_limit(r, ip_key, email_key)
            raise UnauthorizedException("Email hoặc mật khẩu không đúng", "INVALID_CREDENTIALS")

        if user.isLocked:
            raise LockedAccountException(user.lockReason or "Tài khoản đang bị khóa", "ACCOUNT_LOCKED")

        if not verify_password(body.password, user.passwordHash):
            await self._increment_rate_limit(r, ip_key, email_key)
            raise UnauthorizedException("Email hoặc mật khẩu không đúng", "INVALID_CREDENTIALS")

        if not user.emailVerified:
            await self._increment_rate_limit(r, ip_key, email_key)
            raise ForbiddenException("Vui lòng xác thực email trước khi đăng nhập", "EMAIL_NOT_VERIFIED")

        await r.delete(ip_key, email_key)

        await self.repo.update_user(user.id, {"lastLoginAt": datetime.now(timezone.utc)})

        # Create tokens and get the session ID
        tokens, sid = await self._create_tokens(user.id)

        session_key = f"auth:session:{user.id}:{sid}"
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

    async def logout(self, user_id: str, refresh_token: Optional[str] = None, access_token: Optional[str] = None) -> str:
        r = await get_redis()
        
        # If access token provided, invalidate specific session
        if access_token:
            payload = decode_token(access_token)
            if payload and payload.get("sid"):
                sid = payload["sid"]
                await r.delete(f"auth:session:{user_id}:{sid}")
        else:
            # Fallback: if no specific session, we might want to delete all? 
            # For now, just require access_token or token_hash from refresh
            pass

        if refresh_token:
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            # If we used token_hash as sid (which we do in refresh), delete that too
            await r.delete(f"auth:session:{user_id}:{token_hash}")
            
            rt = await self.repo.get_refresh_token_by_hash(token_hash)
            if rt and rt.revokedAt is None:
                await self.repo.revoke_refresh_token(rt.id)
                remaining = (rt.expiresAt - datetime.now(timezone.utc)).total_seconds()
                if remaining > 0:
                    await r.set(f"auth:blacklist:{token_hash}", "revoked", ex=int(remaining))

        return "Đăng xuất thành công"

    # ─── Refresh Token ─────────────────────────────────────────────────────

    async def refresh_access_token(self, body: RefreshTokenRequest) -> TokenResponse:
        payload = decode_token(body.refresh_token)
        if payload is None or payload.get("type") != "refresh":
            raise UnauthorizedException("Mã làm mới không hợp lệ", "INVALID_REFRESH_TOKEN")

        token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()
        r = await get_redis()
        blacklisted = await r.exists(f"auth:blacklist:{token_hash}")
        if blacklisted:
            raise UnauthorizedException("Mã làm mới đã bị thu hồi", "TOKEN_REVOKED")

        rt = await self.repo.get_refresh_token_by_hash(token_hash)
        if rt is None:
            raise UnauthorizedException("Không tìm thấy mã làm mới", "TOKEN_NOT_FOUND")
        if rt.revokedAt is not None:
            raise UnauthorizedException("Mã làm mới đã bị thu hồi", "TOKEN_REVOKED")
        if rt.expiresAt < datetime.now(timezone.utc):
            raise UnauthorizedException("Mã làm mới đã hết hạn", "TOKEN_EXPIRED")

        user = await self.repo.get_user_by_id(rt.userId)
        if user is None or user.isLocked or user.deletedAt is not None:
            raise UnauthorizedException("Tài khoản người dùng không hoạt động", "ACCOUNT_INACTIVE")

        await self.repo.revoke_refresh_token(rt.id)
        remaining = (rt.expiresAt - datetime.now(timezone.utc)).total_seconds()
        if remaining > 0:
            await r.set(f"auth:blacklist:{token_hash}", "revoked", ex=int(remaining))

        # Create new tokens using same sid if possible or new one
        tokens, new_sid = await self._create_tokens(user.id)
        
        # Migrate session to new sid
        old_session = await r.get(f"auth:session:{user.id}:{token_hash}")
        if old_session:
            await r.set(f"auth:session:{user.id}:{new_sid}", old_session, ex=86400)
            await r.delete(f"auth:session:{user.id}:{token_hash}")

        return tokens

    # ─── Forgot Password ───────────────────────────────────────────────────

    async def forgot_password(self, body: SendOtpRequest) -> str:
        user = await self.repo.get_user_by_email(body.email)
        if user is None or user.deletedAt is not None:
            return "Nếu email tồn tại, mã OTP đã được gửi"

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
        return "Nếu email tồn tại, mã OTP đã được gửi"

    async def reset_password(self, body: ResetPasswordRequest) -> str:
        cached = await get_cached_otp(body.email, "reset_password")
        if cached is None:
            raise BadRequestException("Mã OTP không tồn tại hoặc đã hết hạn", "OTP_EXPIRED")

        if cached["attempts"] >= cached["max_attempts"]:
            await delete_cached_otp(body.email, "reset_password")
            raise TooManyRequestsException("Vượt quá số lần nhập OTP tối đa", "OTP_MAX_ATTEMPTS")

        if cached["code"] != body.code:
            await increment_otp_attempts(body.email, "reset_password")
            raise BadRequestException("Mã OTP không hợp lệ", "INVALID_OTP")

        user = await self.repo.get_user_by_email(body.email)
        if user is None:
            raise NotFoundException("Không tìm thấy người dùng", "USER_NOT_FOUND")

        await self.repo.update_user(user.id, {"passwordHash": hash_password(body.new_password)})
        await self.repo.revoke_all_user_tokens(user.id)
        await delete_cached_otp(body.email, "reset_password")
        await self.repo.invalidate_otps(body.email, "reset_password")

        r = await get_redis()
        await r.delete(f"auth:session:{user.id}")

        return "Đặt lại mật khẩu thành công"

    # ─── Change Password ───────────────────────────────────────────────────

    async def change_password(self, user_id: str, body: ChangePasswordRequest) -> str:
        user = await self.repo.get_user_by_id(user_id)
        if user is None:
            raise NotFoundException("Không tìm thấy người dùng", "USER_NOT_FOUND")

        if not verify_password(body.current_password, user.passwordHash):
            raise BadRequestException("Mật khẩu hiện tại không đúng", "WRONG_PASSWORD")

        await self.repo.update_user(user.id, {"passwordHash": hash_password(body.new_password)})
        await self.repo.revoke_all_user_tokens(user_id)

        r = await get_redis()
        await r.delete(f"auth:session:{user_id}")

        return "Thay đổi mật khẩu thành công. Vui lòng đăng nhập lại."

    # ─── Profile ───────────────────────────────────────────────────────────

    async def search_users(self, query: str, limit: int = 10) -> list[ProfileResponse]:
        users = await self.repo.search_users(query, limit)
        return [
            ProfileResponse(
                id=u.id,
                email="",  # Masked for privacy
                full_name=u.fullName,
                phone_number="",  # Masked for privacy
                avatar_url=u.avatarUrl,
                cover_url=u.coverUrl,
                email_verified=u.emailVerified,
                role=u.roleRef.role if u.roleRef else "student",
                created_at=u.createdAt,
            )
            for u in users
        ]

    async def get_profile(self, user_id: str) -> ProfileResponse:
        from app.core.cache import get_user_profile_cache, set_user_profile_cache
        cached = await get_user_profile_cache(user_id)
        if cached:
            # Need to convert string dates back if necessary, but model_validate is smart
            return ProfileResponse.model_validate(cached)

        user = await self.repo.get_user_by_id(user_id)
        if user is None:
            raise NotFoundException("Không tìm thấy người dùng", "USER_NOT_FOUND")

        role = await self.repo.db.role.find_unique(where={"id": user.roleId})

        profile = ProfileResponse(
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
        await set_user_profile_cache(user_id, profile.model_dump())
        return profile

    async def update_profile(self, user_id: str, body: UpdateProfileRequest) -> ProfileResponse:
        data = body.model_dump(exclude_none=True)
        if not data:
            raise BadRequestException("Không có dữ liệu nào để cập nhật", "EMPTY_UPDATE")

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
        from app.core.cache import get_user_privacy_cache, set_user_privacy_cache
        cached = await get_user_privacy_cache(user_id)
        from app.modules.account.schemas import PrivacySettingsResponse
        if cached:
            return PrivacySettingsResponse.model_validate(cached)

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
        response = PrivacySettingsResponse(
            who_can_see_posts=ps.whoCanSeePosts,
            who_can_message=ps.whoCanMessage,
            who_can_friend_req=ps.whoCanFriendReq,
        )
        await set_user_privacy_cache(user_id, response.model_dump())
        return response

    async def update_privacy_settings(self, user_id: str, body: UpdatePrivacySettingsRequest):
        data = body.model_dump(exclude_none=True)
        field_map = {
            "who_can_see_posts": "whoCanSeePosts",
            "who_can_message": "whoCanMessage",
            "who_can_friend_req": "whoCanFriendReq",
        }
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
        from app.core.cache import get_user_notif_settings_cache, set_user_notif_settings_cache
        cached = await get_user_notif_settings_cache(user_id)
        from app.modules.account.schemas import NotificationSettingsResponse
        if cached:
            return NotificationSettingsResponse.model_validate(cached)

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
        response = NotificationSettingsResponse(
            notify_like=ns.notifyLike,
            notify_comment=ns.notifyComment,
            notify_reply=ns.notifyReply,
            notify_friend_req=ns.notifyFriendReq,
            notify_message=ns.notifyMessage,
            notify_schedule=ns.notifySchedule,
        )
        await set_user_notif_settings_cache(user_id, response.model_dump())
        return response

    async def update_notification_settings(self, user_id: str, body: UpdateNotificationSettingsRequest):
        data = body.model_dump(exclude_none=True)
        field_map = {
            "notify_like": "notifyLike",
            "notify_comment": "notifyComment",
            "notify_reply": "notifyReply",
            "notify_friend_req": "notifyFriendReq",
            "notify_message": "notifyMessage",
            "notify_schedule": "notifySchedule"
        }

        prisma_data = {}
        for k, v in data.items():
            prisma_key = field_map.get(k)
            if prisma_key:
                prisma_data[prisma_key] = v

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

    async def _create_tokens(self, user_id: str) -> tuple[TokenResponse, str]:
        refresh_token = create_refresh_token(user_id)
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        
        # Use token_hash as sid for simplicity
        sid = token_hash
        access_token = create_access_token(user_id, extra_claims={"sid": sid})

        await self.repo.create_refresh_token(
            data={
                "userId": user_id,
                "tokenHash": token_hash,
                "expiresAt": datetime.now(timezone.utc) + __import__("datetime").timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            }
        )

        return TokenResponse(access_token=access_token, refresh_token=refresh_token), sid

    async def _increment_rate_limit(self, r, ip_key: str, email_key: str) -> None:
        ip_count = await r.incr(ip_key)
        if ip_count == 1:
            await r.expire(ip_key, settings.LOGIN_RATE_LIMIT_IP_WINDOW_SECONDS)

        email_count = await r.incr(email_key)
        if email_count == 1:
            await r.expire(email_key, settings.LOGIN_RATE_LIMIT_EMAIL_WINDOW_SECONDS)

