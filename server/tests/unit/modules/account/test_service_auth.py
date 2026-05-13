"""
Unit tests for auth flows on ``AccountService``: login, logout, refresh, forgot/reset/change password.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from jose import jwt

from app.core.config import get_settings
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    LockedAccountException,
    NotFoundException,
    TooManyRequestsException,
    UnauthorizedException,
)
from app.core.security import create_refresh_token, hash_password
from app.modules.account.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    SendOtpRequest,
)
from tests.unit.conftest import make_fake_user, make_fake_role


settings = get_settings()


def _login_user(**kwargs):
    pw = kwargs.pop("password", "secret123")
    h = kwargs.pop("passwordHash", None) or hash_password(pw)
    defaults = dict(
        id="user-1",
        email="u@u.com",
        fullName="User",
        roleId="role-s",
        avatarUrl=None,
        passwordHash=h,
        emailVerified=True,
        deletedAt=None,
        isLocked=False,
        lockReason=None,
    )
    defaults.update(kwargs)
    return make_fake_user(**defaults)


@pytest.mark.asyncio
class TestLogin:
    async def test_user_not_found(self, account_service, mock_account_repo, patch_get_redis):
        mock_account_repo.get_user_by_email.return_value = None
        with pytest.raises(UnauthorizedException) as e:
            await account_service.login(
                LoginRequest(email="n@n.com", password="x"), ip_address="127.0.0.1"
            )
        assert e.value.error_code == "INVALID_CREDENTIALS"

    async def test_deleted_user_same_as_missing(self, account_service, mock_account_repo, patch_get_redis):
        u = make_fake_user(deletedAt=datetime.now(timezone.utc))
        mock_account_repo.get_user_by_email.return_value = u
        with pytest.raises(UnauthorizedException) as e:
            await account_service.login(
                LoginRequest(email="u@u.com", password="secret123"), ip_address="127.0.0.1"
            )
        assert e.value.error_code == "INVALID_CREDENTIALS"

    async def test_wrong_password(self, account_service, mock_account_repo, patch_get_redis):
        mock_account_repo.get_user_by_email.return_value = _login_user()
        with pytest.raises(UnauthorizedException) as e:
            await account_service.login(
                LoginRequest(email="u@u.com", password="wrong-pass-here"), ip_address="127.0.0.1"
            )
        assert e.value.error_code == "INVALID_CREDENTIALS"

    async def test_locked_account(self, account_service, mock_account_repo, patch_get_redis):
        mock_account_repo.get_user_by_email.return_value = _login_user(
            isLocked=True, lockReason="Abuse"
        )
        with pytest.raises(LockedAccountException) as e:
            await account_service.login(
                LoginRequest(email="u@u.com", password="secret123"), ip_address="127.0.0.1"
            )
        assert e.value.error_code == "ACCOUNT_LOCKED"

    async def test_email_not_verified(self, account_service, mock_account_repo, patch_get_redis):
        mock_account_repo.get_user_by_email.return_value = _login_user(emailVerified=False)
        with pytest.raises(ForbiddenException) as e:
            await account_service.login(
                LoginRequest(email="u@u.com", password="secret123"), ip_address="127.0.0.1"
            )
        assert e.value.error_code == "EMAIL_NOT_VERIFIED"

    async def test_ip_rate_limited(self, account_service, mock_account_repo, patch_get_redis):
        r = patch_get_redis
        ip_key = f"rate:login:ip:10.0.0.1"
        await r.set(ip_key, str(settings.LOGIN_RATE_LIMIT_IP))
        mock_account_repo.get_user_by_email.return_value = _login_user()
        with pytest.raises(TooManyRequestsException) as e:
            await account_service.login(
                LoginRequest(email="u@u.com", password="secret123"), ip_address="10.0.0.1"
            )
        assert e.value.error_code == "IP_RATE_LIMITED"

    async def test_email_rate_limited(self, account_service, mock_account_repo, patch_get_redis):
        r = patch_get_redis
        await r.set(f"rate:login:email:u@u.com", str(settings.LOGIN_RATE_LIMIT_EMAIL))
        mock_account_repo.get_user_by_email.return_value = _login_user()
        with pytest.raises(TooManyRequestsException) as e:
            await account_service.login(
                LoginRequest(email="u@u.com", password="secret123"), ip_address="127.0.0.1"
            )
        assert e.value.error_code == "EMAIL_RATE_LIMITED"

    async def test_success_returns_tokens_and_writes_session(
        self, account_service, mock_account_repo, patch_get_redis
    ):
        user = _login_user()
        mock_account_repo.get_user_by_email.return_value = user
        mock_account_repo.create_refresh_token = AsyncMock(return_value=MagicMock())

        tokens = await account_service.login(
            LoginRequest(email="u@u.com", password="secret123"), ip_address="192.168.1.5"
        )
        assert tokens.access_token
        assert tokens.refresh_token
        mock_account_repo.update_user.assert_awaited()
        r = patch_get_redis
        th = hashlib.sha256(tokens.refresh_token.encode()).hexdigest()
        session = await r.get(f"auth:session:user-1:{th}")
        assert session is not None
        payload = json.loads(session)
        assert payload["user_id"] == "user-1"


@pytest.mark.asyncio
class TestLogout:
    async def test_with_refresh_revokes_and_blacklists(
        self, account_service, mock_account_repo, patch_get_redis
    ):
        rt_plain = create_refresh_token("user-1")
        th = hashlib.sha256(rt_plain.encode()).hexdigest()
        exp = datetime.now(timezone.utc) + timedelta(days=1)
        rt_row = MagicMock()
        rt_row.id = "rt-1"
        rt_row.revokedAt = None
        rt_row.expiresAt = exp
        mock_account_repo.get_refresh_token_by_hash.return_value = rt_row

        msg = await account_service.logout("user-1", refresh_token=rt_plain, access_token=None)
        assert "thành công" in msg.lower()
        mock_account_repo.revoke_refresh_token.assert_awaited_with("rt-1")
        exists = await patch_get_redis.exists(f"auth:blacklist:{th}")
        assert exists is True


@pytest.mark.asyncio
class TestRefreshAccessToken:
    async def test_invalid_refresh_jwt(self, account_service, patch_get_redis):
        with pytest.raises(UnauthorizedException) as e:
            await account_service.refresh_access_token(
                RefreshTokenRequest(refresh_token="not-a-jwt")
            )
        assert e.value.error_code == "INVALID_REFRESH_TOKEN"

    async def test_blacklisted(self, account_service, patch_get_redis):
        rt = create_refresh_token("user-1")
        th = hashlib.sha256(rt.encode()).hexdigest()
        await patch_get_redis.set(f"auth:blacklist:{th}", "revoked")
        with pytest.raises(UnauthorizedException) as e:
            await account_service.refresh_access_token(RefreshTokenRequest(refresh_token=rt))
        assert e.value.error_code == "TOKEN_REVOKED"

    async def test_token_row_not_found(self, account_service, mock_account_repo, patch_get_redis):
        rt = create_refresh_token("user-1")
        mock_account_repo.get_refresh_token_by_hash.return_value = None
        with pytest.raises(UnauthorizedException) as e:
            await account_service.refresh_access_token(RefreshTokenRequest(refresh_token=rt))
        assert e.value.error_code == "TOKEN_NOT_FOUND"

    async def test_token_revoked_in_db(self, account_service, mock_account_repo, patch_get_redis):
        rt = create_refresh_token("user-1")
        row = MagicMock()
        row.revokedAt = datetime.now(timezone.utc)
        mock_account_repo.get_refresh_token_by_hash.return_value = row
        with pytest.raises(UnauthorizedException) as e:
            await account_service.refresh_access_token(RefreshTokenRequest(refresh_token=rt))
        assert e.value.error_code == "TOKEN_REVOKED"

    async def test_token_expired(self, account_service, mock_account_repo, patch_get_redis):
        rt = create_refresh_token("user-1")
        row = MagicMock()
        row.revokedAt = None
        row.expiresAt = datetime.now(timezone.utc) - timedelta(seconds=1)
        row.id = "rt-x"
        mock_account_repo.get_refresh_token_by_hash.return_value = row
        with pytest.raises(UnauthorizedException) as e:
            await account_service.refresh_access_token(RefreshTokenRequest(refresh_token=rt))
        assert e.value.error_code == "TOKEN_EXPIRED"

    async def test_user_inactive(self, account_service, mock_account_repo, patch_get_redis):
        rt = create_refresh_token("user-1")
        row = MagicMock()
        row.revokedAt = None
        row.expiresAt = datetime.now(timezone.utc) + timedelta(days=1)
        row.id = "rt-x"
        row.userId = "user-1"
        mock_account_repo.get_refresh_token_by_hash.return_value = row
        mock_account_repo.get_user_by_id.return_value = None
        with pytest.raises(UnauthorizedException) as e:
            await account_service.refresh_access_token(RefreshTokenRequest(refresh_token=rt))
        assert e.value.error_code == "ACCOUNT_INACTIVE"

    async def test_success_rotates_refresh_and_migrates_session(
        self, account_service, mock_account_repo, patch_get_redis
    ):
        rt = create_refresh_token("user-1")
        th = hashlib.sha256(rt.encode()).hexdigest()
        row = MagicMock()
        row.revokedAt = None
        row.expiresAt = datetime.now(timezone.utc) + timedelta(days=7)
        row.id = "rt-old"
        row.userId = "user-1"
        mock_account_repo.get_refresh_token_by_hash.return_value = row
        u = _login_user()
        mock_account_repo.get_user_by_id.return_value = u
        mock_account_repo.create_refresh_token = AsyncMock(return_value=MagicMock())

        old_session = json.dumps({"user_id": "user-1"})
        await patch_get_redis.set(f"auth:session:user-1:{th}", old_session)

        tokens = await account_service.refresh_access_token(RefreshTokenRequest(refresh_token=rt))
        assert tokens.access_token and tokens.refresh_token
        new_th = hashlib.sha256(tokens.refresh_token.encode()).hexdigest()
        moved = await patch_get_redis.get(f"auth:session:user-1:{new_th}")
        assert moved == old_session
        assert await patch_get_redis.get(f"auth:session:user-1:{th}") is None


@pytest.mark.asyncio
class TestForgotPassword:
    async def test_unknown_email_generic_message(self, account_service, mock_account_repo, mock_send_otp_email):
        mock_account_repo.get_user_by_email.return_value = None
        msg = await account_service.forgot_password(
            SendOtpRequest(email="ghost@x.com", purpose="reset_password")
        )
        assert "email" in msg.lower()
        mock_send_otp_email.assert_not_called()

    async def test_known_user_sends_otp(
        self, account_service, mock_account_repo, mock_send_otp_email, patch_get_redis
    ):
        mock_account_repo.get_user_by_email.return_value = _login_user(email="a@a.com")
        with patch("app.modules.account.service.generate_otp", return_value="444444"):
            msg = await account_service.forgot_password(
                SendOtpRequest(email="a@a.com", purpose="reset_password")
            )
        assert "email" in msg.lower()
        mock_send_otp_email.assert_awaited()


@pytest.mark.asyncio
class TestResetPassword:
    async def test_no_otp_cache(self, account_service, patch_get_redis):
        with pytest.raises(BadRequestException) as e:
            await account_service.reset_password(
                ResetPasswordRequest(email="x@x.com", code="123456", new_password="newpass12")
            )
        assert e.value.error_code == "OTP_EXPIRED"

    async def test_wrong_code(self, account_service, patch_get_redis):
        from app.utils.email import cache_otp

        await cache_otp("rp@rp.com", "reset_password", "111111")
        with pytest.raises(BadRequestException) as e:
            await account_service.reset_password(
                ResetPasswordRequest(email="rp@rp.com", code="999999", new_password="newpass12")
            )
        assert e.value.error_code == "INVALID_OTP"

    async def test_success_updates_password(
        self, account_service, mock_account_repo, patch_get_redis
    ):
        from app.utils.email import cache_otp

        email = "ok2@ok.com"
        await cache_otp(email, "reset_password", "888888")
        u = make_fake_user(id="uu-2", email=email)
        mock_account_repo.get_user_by_email.return_value = u

        msg = await account_service.reset_password(
            ResetPasswordRequest(email=email, code="888888", new_password="brandnew1")
        )
        assert "thành công" in msg.lower()
        mock_account_repo.update_user.assert_awaited()
        mock_account_repo.revoke_all_user_tokens.assert_awaited_with("uu-2")


@pytest.mark.asyncio
class TestChangePassword:
    async def test_user_not_found(self, account_service, mock_account_repo):
        mock_account_repo.get_user_by_id.return_value = None
        with pytest.raises(NotFoundException):
            await account_service.change_password(
                "missing",
                ChangePasswordRequest(current_password="a", new_password="newpass12"),
            )

    async def test_wrong_current_password(self, account_service, mock_account_repo):
        mock_account_repo.get_user_by_id.return_value = _login_user()
        with pytest.raises(BadRequestException) as e:
            await account_service.change_password(
                "user-1",
                ChangePasswordRequest(current_password="nope", new_password="newpass12"),
            )
        assert e.value.error_code == "WRONG_PASSWORD"

    async def test_success(self, account_service, mock_account_repo, patch_get_redis):
        mock_account_repo.get_user_by_id.return_value = _login_user()
        msg = await account_service.change_password(
            "user-1",
            ChangePasswordRequest(current_password="secret123", new_password="another12"),
        )
        assert "thành công" in msg.lower()
        mock_account_repo.update_user.assert_awaited()
        mock_account_repo.revoke_all_user_tokens.assert_awaited_with("user-1")


@pytest.mark.asyncio
class TestLogoutWithAccessToken:
    async def test_deletes_session_when_sid_in_access_token(
        self, account_service, mock_account_repo, patch_get_redis
    ):
        sid = "session-id-xyz"
        access = jwt.encode(
            {"sub": "user-1", "type": "access", "sid": sid, "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )
        await patch_get_redis.set(f"auth:session:user-1:{sid}", '{"user_id":"user-1"}')
        await account_service.logout("user-1", refresh_token=None, access_token=access)
        assert await patch_get_redis.get(f"auth:session:user-1:{sid}") is None
