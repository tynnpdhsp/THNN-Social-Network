"""
Unit tests for OTP-related flows on ``AccountService`` (register, verify, resend).
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
    TooManyRequestsException,
)
from app.modules.account.schemas import RegisterRequest, SendOtpRequest, VerifyOtpRequest
from tests.unit.conftest import make_fake_user, make_fake_role


@pytest.fixture()
def svc(account_service):
    return account_service


@pytest.fixture()
def repo(mock_account_repo):
    return mock_account_repo


@pytest.mark.asyncio
class TestResendVerificationOtp:
    async def test_user_not_found(self, svc, repo):
        repo.get_user_by_email.return_value = None
        with pytest.raises(BadRequestException) as e:
            await svc.resend_verification_otp(SendOtpRequest(email="n@n.com", purpose="register"))
        assert e.value.error_code == "INVALID_REQUEST"

    async def test_user_deleted(self, svc, repo):
        u = make_fake_user(deletedAt=datetime.now(timezone.utc))
        repo.get_user_by_email.return_value = u
        with pytest.raises(BadRequestException) as e:
            await svc.resend_verification_otp(SendOtpRequest(email="n@n.com", purpose="register"))
        assert e.value.error_code == "INVALID_REQUEST"

    async def test_already_verified(self, svc, repo):
        u = make_fake_user(emailVerified=True)
        repo.get_user_by_email.return_value = u
        with pytest.raises(BadRequestException) as e:
            await svc.resend_verification_otp(SendOtpRequest(email="n@n.com", purpose="register"))
        assert e.value.error_code == "ALREADY_VERIFIED"

    async def test_success_calls_repo_and_email(
        self, svc, repo, patch_get_redis, mock_send_otp_email
    ):
        u = make_fake_user(emailVerified=False, deletedAt=None, email="u@u.com")
        repo.get_user_by_email.return_value = u
        with patch("app.modules.account.service.generate_otp", return_value="111111"):
            msg = await svc.resend_verification_otp(
                SendOtpRequest(email="u@u.com", purpose="register")
            )
        assert "OTP" in msg or "mã" in msg.lower()
        repo.invalidate_otps.assert_awaited_once_with("u@u.com", "register")
        repo.create_otp.assert_awaited()
        mock_send_otp_email.assert_awaited_once_with("u@u.com", "111111", "register")


@pytest.mark.asyncio
class TestRegister:
    async def test_email_exists_verified(self, svc, repo):
        u = make_fake_user(emailVerified=True, deletedAt=None)
        repo.get_user_by_email.return_value = u
        with pytest.raises(ConflictException) as e:
            await svc.register(
                RegisterRequest(
                    email="e@e.com",
                    password="password1",
                    confirm_password="password1",
                    full_name="A",
                    phone_number="0901234567",
                )
            )
        assert e.value.error_code == "EMAIL_EXISTS"

    async def test_email_exists_unverified(self, svc, repo):
        u = make_fake_user(emailVerified=False, deletedAt=None)
        repo.get_user_by_email.return_value = u
        with pytest.raises(ConflictException) as e:
            await svc.register(
                RegisterRequest(
                    email="e@e.com",
                    password="password1",
                    confirm_password="password1",
                    full_name="A",
                    phone_number="0901234567",
                )
            )
        assert e.value.error_code == "UNVERIFIED_EMAIL_EXISTS"

    async def test_role_not_found(self, svc, repo):
        repo.get_user_by_email.return_value = None
        repo.get_role_by_name.return_value = None
        with pytest.raises(NotFoundException) as e:
            await svc.register(
                RegisterRequest(
                    email="new@e.com",
                    password="password1",
                    confirm_password="password1",
                    full_name="A",
                    phone_number="0901234567",
                )
            )
        assert e.value.error_code == "ROLE_NOT_FOUND"

    async def test_success_creates_user_and_sends_otp(
        self, svc, repo, patch_get_redis, mock_send_otp_email
    ):
        repo.get_user_by_email.return_value = None
        role = make_fake_role(id="role-1", role="student")
        repo.get_role_by_name.return_value = role
        created = make_fake_user(id="new-id", email="new@e.com", emailVerified=False)
        repo.create_user.return_value = created
        with patch("app.modules.account.service.generate_otp", return_value="222222"):
            msg = await svc.register(
                RegisterRequest(
                    email="new@e.com",
                    password="password1",
                    confirm_password="password1",
                    full_name="New User",
                    phone_number="0901234567",
                )
            )
        assert "Đăng ký" in msg or "email" in msg.lower()
        repo.create_user.assert_awaited_once()
        call_kw = repo.create_user.await_args.kwargs["data"]
        assert call_kw["email"] == "new@e.com"
        assert call_kw["emailVerified"] is False
        assert call_kw["roleId"] == "role-1"
        mock_send_otp_email.assert_awaited_once_with("new@e.com", "222222", "register")


@pytest.mark.asyncio
class TestVerifyOtp:
    async def test_no_cache_expired(self, svc, patch_get_redis):
        with pytest.raises(BadRequestException) as e:
            await svc.verify_otp(
                VerifyOtpRequest(email="x@x.com", code="123456", purpose="register")
            )
        assert e.value.error_code == "OTP_EXPIRED"

    async def test_max_attempts(self, svc, patch_get_redis):
        from app.utils.email import cache_otp
        from app.core.config import get_settings

        s = get_settings()
        await cache_otp("x@x.com", "register", "111111")
        r = patch_get_redis
        key = "auth:otp:x@x.com:register"
        raw = await r.get(key)
        import json

        data = json.loads(raw)
        data["attempts"] = s.OTP_MAX_ATTEMPTS
        await r.set(key, json.dumps(data), ex=60)

        with pytest.raises(TooManyRequestsException) as e:
            await svc.verify_otp(
                VerifyOtpRequest(email="x@x.com", code="111111", purpose="register")
            )
        assert e.value.error_code == "OTP_MAX_ATTEMPTS"

    async def test_wrong_code_increments(self, svc, patch_get_redis):
        from app.utils.email import cache_otp

        await cache_otp("w@w.com", "register", "999999")
        with pytest.raises(BadRequestException) as e:
            await svc.verify_otp(
                VerifyOtpRequest(email="w@w.com", code="000000", purpose="register")
            )
        assert e.value.error_code == "INVALID_OTP"
        assert "Còn lại" in e.value.detail or "lần" in e.value.detail

    async def test_register_success_updates_user_and_clears_cache(
        self, svc, repo, patch_get_redis, mock_send_otp_email
    ):
        from app.utils.email import cache_otp, get_cached_otp

        email = "ok@ok.com"
        await cache_otp(email, "register", "654321")
        user = make_fake_user(id="uid-1", email=email, emailVerified=False)
        repo.get_user_by_email.return_value = user
        repo.update_user.return_value = user

        msg = await svc.verify_otp(
            VerifyOtpRequest(email=email, code="654321", purpose="register")
        )
        assert "thành công" in msg.lower()
        repo.update_user.assert_awaited_with("uid-1", {"emailVerified": True})
        assert await get_cached_otp(email, "register") is None

    async def test_reset_password_correct_keeps_cache_until_reset(
        self, svc, repo, patch_get_redis
    ):
        from app.utils.email import cache_otp, get_cached_otp

        email = "rs@rs.com"
        await cache_otp(email, "reset_password", "333333")

        msg = await svc.verify_otp(
            VerifyOtpRequest(email=email, code="333333", purpose="reset_password")
        )
        assert "thành công" in msg.lower()
        data = await get_cached_otp(email, "reset_password")
        assert data is not None
        assert data["code"] == "333333"
