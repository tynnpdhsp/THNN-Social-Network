"""
Unit tests for ``app/utils/email.py``.

Uses ``patch_get_redis`` (MockRedis) for cache_otp / get_cached_otp /
increment_otp_attempts / delete_cached_otp.

Uses ``unittest.mock`` for SMTP (send_otp_email).

Covers:
- cache_otp / get_cached_otp round-trip
- increment_otp_attempts: normal, missing key returns -1
- delete_cached_otp
- send_otp_email: correct subject by purpose, body contains code + expire,
  SMTP error propagates
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.utils.email import (
    cache_otp,
    get_cached_otp,
    increment_otp_attempts,
    delete_cached_otp,
    send_otp_email,
    OTP_EMAIL_SUBJECTS,
)


def test_otp_email_subjects_cover_known_purposes():
    assert "register" in OTP_EMAIL_SUBJECTS
    assert "reset_password" in OTP_EMAIL_SUBJECTS


# ─── cache_otp / get_cached_otp ──────────────────────────────────────────────

class TestCacheOtp:
    @pytest.mark.asyncio
    async def test_cache_then_get(self, patch_get_redis):
        await cache_otp("a@b.com", "register", "123456")
        data = await get_cached_otp("a@b.com", "register")
        assert data is not None
        assert data["code"] == "123456"
        assert data["attempts"] == 0

    @pytest.mark.asyncio
    async def test_get_missing_returns_none(self, patch_get_redis):
        result = await get_cached_otp("no@one.com", "register")
        assert result is None

    @pytest.mark.asyncio
    async def test_different_purposes_isolated(self, patch_get_redis):
        await cache_otp("x@y.com", "register", "111111")
        await cache_otp("x@y.com", "reset_password", "222222")

        reg = await get_cached_otp("x@y.com", "register")
        rst = await get_cached_otp("x@y.com", "reset_password")
        assert reg["code"] == "111111"
        assert rst["code"] == "222222"

    @pytest.mark.asyncio
    async def test_max_attempts_stored(self, patch_get_redis):
        await cache_otp("m@m.com", "register", "000000")
        data = await get_cached_otp("m@m.com", "register")
        assert data["max_attempts"] == 3  # From settings default


# ─── increment_otp_attempts ──────────────────────────────────────────────────

class TestIncrementOtpAttempts:
    @pytest.mark.asyncio
    async def test_increment_from_zero(self, patch_get_redis):
        await cache_otp("a@b.com", "register", "123456")
        result = await increment_otp_attempts("a@b.com", "register")
        assert result == 1

    @pytest.mark.asyncio
    async def test_increment_twice(self, patch_get_redis):
        await cache_otp("a@b.com", "register", "123456")
        await increment_otp_attempts("a@b.com", "register")
        result = await increment_otp_attempts("a@b.com", "register")
        assert result == 2

    @pytest.mark.asyncio
    async def test_missing_key_returns_minus_one(self, patch_get_redis):
        result = await increment_otp_attempts("gone@gone.com", "register")
        assert result == -1

    @pytest.mark.asyncio
    async def test_increment_preserves_code(self, patch_get_redis):
        await cache_otp("a@b.com", "register", "654321")
        await increment_otp_attempts("a@b.com", "register")
        data = await get_cached_otp("a@b.com", "register")
        assert data["code"] == "654321"
        assert data["attempts"] == 1

    @pytest.mark.asyncio
    async def test_increment_uses_ex_zero_when_ttl_minus_one(self, patch_get_redis):
        """``increment_otp_attempts`` uses ``ex=max(ttl, 0)`` when rewriting JSON."""
        r = patch_get_redis
        captured_ex = []

        orig_set = r.set

        async def capture_set(key, value, ex=None):
            captured_ex.append(ex)
            return await orig_set(key, value, ex=ex)

        r.set = capture_set

        async def ttl_always_minus_one(_key):
            return -1

        r.ttl = ttl_always_minus_one

        await cache_otp("ttl@x.com", "register", "123456")
        await increment_otp_attempts("ttl@x.com", "register")

        assert captured_ex[-1] == 0


# ─── delete_cached_otp ───────────────────────────────────────────────────────

class TestDeleteCachedOtp:
    @pytest.mark.asyncio
    async def test_delete_existing(self, patch_get_redis):
        await cache_otp("a@b.com", "register", "123456")
        await delete_cached_otp("a@b.com", "register")
        result = await get_cached_otp("a@b.com", "register")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_no_error(self, patch_get_redis):
        await delete_cached_otp("no@no.com", "register")  # Should not raise


# ─── send_otp_email ──────────────────────────────────────────────────────────

class TestSendOtpEmail:
    @staticmethod
    def _email_html_text(msg) -> str:
        """Extract HTML body from multipart OTP message for assertions."""
        if msg.is_multipart():
            for part in msg.get_payload():
                if getattr(part, "get_content_type", lambda: None)() == "text/html":
                    raw = part.get_payload(decode=True)
                    return raw.decode() if isinstance(raw, bytes) else str(raw)
        raw = msg.get_payload(decode=True)
        return raw.decode() if isinstance(raw, bytes) else str(raw)

    @pytest.mark.asyncio
    async def test_register_purpose_subject(self):
        with patch("aiosmtplib.send", new=AsyncMock()) as mock_send:
            await send_otp_email("user@x.com", "123456", "register")

            mock_send.assert_called_once()
            msg = mock_send.call_args[0][0]
            assert msg["Subject"].startswith("[THNN]")
            assert "Xác thực đăng ký tài khoản" in msg["Subject"]

    @pytest.mark.asyncio
    async def test_reset_password_purpose_subject(self):
        with patch("aiosmtplib.send", new=AsyncMock()) as mock_send:
            await send_otp_email("user@x.com", "654321", "reset_password")

            msg = mock_send.call_args[0][0]
            assert "đặt lại mật khẩu" in msg["Subject"]

    @pytest.mark.asyncio
    async def test_unknown_purpose_fallback_subject(self):
        with patch("aiosmtplib.send", new=AsyncMock()) as mock_send:
            await send_otp_email("user@x.com", "000000", "unknown_purpose")

            msg = mock_send.call_args[0][0]
            assert "Xác thực" in msg["Subject"]

    @pytest.mark.asyncio
    async def test_body_contains_code(self):
        with patch("aiosmtplib.send", new=AsyncMock()) as mock_send:
            await send_otp_email("user@x.com", "987654", "register")

            msg = mock_send.call_args[0][0]
            html = self._email_html_text(msg)
            assert "987654" in html

    @pytest.mark.asyncio
    async def test_body_contains_expire_minutes(self):
        with patch("aiosmtplib.send", new=AsyncMock()) as mock_send:
            await send_otp_email("user@x.com", "111111", "register")

            html = self._email_html_text(mock_send.call_args[0][0])
            # Default OTP_EXPIRE_MINUTES = 5
            assert "5 phút" in html or "5" in html

    @pytest.mark.asyncio
    async def test_smtp_error_propagates(self):
        with patch("aiosmtplib.send", new=AsyncMock(side_effect=Exception("SMTP connection failed"))):
            with pytest.raises(Exception, match="SMTP connection failed"):
                await send_otp_email("user@x.com", "111111", "register")
