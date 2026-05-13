"""
Unit tests for ``app/core/dependencies.py``.

Covers:
- get_current_user_id: valid access token; refresh token rejected; None payload;
  empty sub
- get_optional_user_id: no token; bad token; valid token
- require_active_user: user None/deleted; locked; unverified email; OK
- require_admin: user None; not admin; admin OK
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.dependencies import (
    get_current_user_id,
    get_optional_user_id,
    require_active_user,
    require_admin,
)
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.core.security import create_access_token, create_refresh_token
from tests.unit.conftest import make_fake_user, make_fake_role


# ─── get_current_user_id ──────────────────────────────────────────────────────

class TestGetCurrentUserId:
    @pytest.mark.asyncio
    async def test_valid_access_token(self):
        token = create_access_token("user-42")
        user_id = await get_current_user_id(token)
        assert user_id == "user-42"

    @pytest.mark.asyncio
    async def test_refresh_token_rejected(self):
        token = create_refresh_token("user-42")
        with pytest.raises(UnauthorizedException) as exc_info:
            await get_current_user_id(token)
        assert exc_info.value.error_code == "INVALID_TOKEN"

    @pytest.mark.asyncio
    async def test_invalid_token_raises(self):
        with pytest.raises(UnauthorizedException):
            await get_current_user_id("garbage.token.here")

    @pytest.mark.asyncio
    async def test_empty_sub_raises(self):
        """Token that decodes but has empty sub → unauthorized."""
        from jose import jwt
        from app.core.config import get_settings
        s = get_settings()
        token = jwt.encode(
            {"sub": "", "type": "access", "exp": 9999999999},
            s.JWT_SECRET_KEY,
            algorithm=s.JWT_ALGORITHM,
        )
        with pytest.raises(UnauthorizedException) as exc_info:
            await get_current_user_id(token)
        assert exc_info.value.error_code == "INVALID_TOKEN"

    @pytest.mark.asyncio
    async def test_none_sub_raises(self):
        from jose import jwt
        from app.core.config import get_settings
        s = get_settings()
        token = jwt.encode(
            {"type": "access", "exp": 9999999999},
            s.JWT_SECRET_KEY,
            algorithm=s.JWT_ALGORITHM,
        )
        with pytest.raises(UnauthorizedException):
            await get_current_user_id(token)

    @pytest.mark.asyncio
    async def test_decode_returns_none_raises_invalid_token(self):
        """Branch when ``decode_token`` yields no payload (simulated bad/expired JWT)."""
        with patch("app.core.dependencies.decode_token", return_value=None):
            with pytest.raises(UnauthorizedException) as exc:
                await get_current_user_id("any.token.string")
            assert exc.value.error_code == "INVALID_TOKEN"

    @pytest.mark.asyncio
    async def test_access_token_missing_type_claim_raises(self):
        """Payload decodes but ``type`` is not ``access`` → rejected."""
        from jose import jwt
        from app.core.config import get_settings
        s = get_settings()
        token = jwt.encode(
            {"sub": "user-1", "exp": 9999999999},
            s.JWT_SECRET_KEY,
            algorithm=s.JWT_ALGORITHM,
        )
        with pytest.raises(UnauthorizedException) as exc:
            await get_current_user_id(token)
        assert exc.value.error_code == "INVALID_TOKEN"


# ─── get_optional_user_id ────────────────────────────────────────────────────

class TestGetOptionalUserId:
    @pytest.mark.asyncio
    async def test_no_token_returns_none(self):
        result = await get_optional_user_id(None)
        assert result is None

    @pytest.mark.asyncio
    async def test_bad_token_returns_none(self):
        result = await get_optional_user_id("invalid.jwt.token")
        assert result is None

    @pytest.mark.asyncio
    async def test_valid_access_token(self):
        token = create_access_token("user-99")
        result = await get_optional_user_id(token)
        assert result == "user-99"

    @pytest.mark.asyncio
    async def test_refresh_token_returns_none(self):
        """Refresh tokens have type=refresh, not access → should return None."""
        token = create_refresh_token("user-99")
        result = await get_optional_user_id(token)
        assert result is None

    @pytest.mark.asyncio
    async def test_empty_string_token_returns_none(self):
        assert await get_optional_user_id("") is None

    @pytest.mark.asyncio
    async def test_access_token_missing_sub_returns_none(self):
        from jose import jwt
        from app.core.config import get_settings
        s = get_settings()
        token = jwt.encode(
            {"type": "access", "exp": 9999999999},
            s.JWT_SECRET_KEY,
            algorithm=s.JWT_ALGORITHM,
        )
        assert await get_optional_user_id(token) is None

    @pytest.mark.asyncio
    async def test_decode_exception_returns_none(self):
        """Any exception from ``decode_token`` is swallowed → None."""

        def boom(_t):
            raise RuntimeError("decode failed")

        with patch("app.core.dependencies.decode_token", side_effect=boom):
            assert await get_optional_user_id("token") is None

class TestRequireActiveUser:
    @pytest.mark.asyncio
    async def test_user_not_found_raises(self):
        repo = AsyncMock()
        repo.get_user_by_id.return_value = None

        with pytest.raises(UnauthorizedException) as exc_info:
            await require_active_user(user_id="u1", repo=repo)
        assert exc_info.value.error_code == "USER_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_deleted_user_raises(self):
        from datetime import datetime, timezone
        user = make_fake_user(deletedAt=datetime.now(timezone.utc))
        repo = AsyncMock()
        repo.get_user_by_id.return_value = user

        with pytest.raises(UnauthorizedException) as exc_info:
            await require_active_user(user_id="u1", repo=repo)
        assert exc_info.value.error_code == "USER_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_locked_user_raises_forbidden(self):
        user = make_fake_user(isLocked=True, lockReason="Spam")
        repo = AsyncMock()
        repo.get_user_by_id.return_value = user

        with pytest.raises(ForbiddenException) as exc_info:
            await require_active_user(user_id="u1", repo=repo)
        assert exc_info.value.error_code == "ACCOUNT_LOCKED"
        assert "Spam" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_locked_user_no_reason_uses_default(self):
        user = make_fake_user(isLocked=True, lockReason=None)
        repo = AsyncMock()
        repo.get_user_by_id.return_value = user

        with pytest.raises(ForbiddenException) as exc_info:
            await require_active_user(user_id="u1", repo=repo)
        assert "bị khóa" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_unverified_email_raises_forbidden(self):
        user = make_fake_user(emailVerified=False)
        repo = AsyncMock()
        repo.get_user_by_id.return_value = user

        with pytest.raises(ForbiddenException) as exc_info:
            await require_active_user(user_id="u1", repo=repo)
        assert exc_info.value.error_code == "EMAIL_NOT_VERIFIED"

    @pytest.mark.asyncio
    async def test_active_user_returns_user_id(self):
        user = make_fake_user(emailVerified=True, isLocked=False, deletedAt=None)
        repo = AsyncMock()
        repo.get_user_by_id.return_value = user

        result = await require_active_user(user_id="u1", repo=repo)
        assert result == "u1"


# ─── require_admin ────────────────────────────────────────────────────────────

class TestRequireAdmin:
    @pytest.mark.asyncio
    async def test_user_not_found_raises(self):
        repo = AsyncMock()
        repo.db.user.find_unique.return_value = None

        with pytest.raises(UnauthorizedException) as exc_info:
            await require_admin(user_id="u1", repo=repo)
        assert exc_info.value.error_code == "USER_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_non_admin_raises_forbidden(self):
        role = make_fake_role(role="student")
        user = make_fake_user(roleRef=role)
        repo = AsyncMock()
        repo.db.user.find_unique.return_value = user

        with pytest.raises(ForbiddenException) as exc_info:
            await require_admin(user_id="u1", repo=repo)
        assert exc_info.value.error_code == "ADMIN_REQUIRED"

    @pytest.mark.asyncio
    async def test_no_role_raises_forbidden(self):
        user = make_fake_user(roleRef=None)
        repo = AsyncMock()
        repo.db.user.find_unique.return_value = user

        with pytest.raises(ForbiddenException):
            await require_admin(user_id="u1", repo=repo)

    @pytest.mark.asyncio
    async def test_admin_returns_user_id(self):
        role = make_fake_role(role="admin")
        user = make_fake_user(roleRef=role)
        repo = AsyncMock()
        repo.db.user.find_unique.return_value = user

        result = await require_admin(user_id="u1", repo=repo)
        assert result == "u1"

    @pytest.mark.asyncio
    async def test_role_admin_case_sensitive(self):
        """``roleRef.role`` must equal ``admin`` exactly (not ``Admin``)."""
        role = make_fake_role(role="Admin")
        user = make_fake_user(roleRef=role)
        repo = AsyncMock()
        repo.db.user.find_unique.return_value = user

        with pytest.raises(ForbiddenException):
            await require_admin(user_id="u1", repo=repo)
