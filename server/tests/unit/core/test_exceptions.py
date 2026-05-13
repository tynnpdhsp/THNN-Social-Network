"""
Unit tests for ``app/core/exceptions.py``.

Verifies every custom exception class:
- inherits from ``AppException`` / ``HTTPException``
- has correct default ``status_code``, ``detail``, ``error_code``
- accepts custom ``detail`` and ``error_code``
"""

import pytest
from fastapi import HTTPException, status

from app.core.exceptions import (
    AppException,
    NotFoundException,
    BadRequestException,
    UnauthorizedException,
    ForbiddenException,
    ConflictException,
    TooManyRequestsException,
    LockedAccountException,
)


# ─── AppException base ────────────────────────────────────────────────────────

class TestAppException:
    def test_is_http_exception(self):
        exc = AppException(status_code=418, detail="I'm a teapot", error_code="TEAPOT")
        assert isinstance(exc, HTTPException)

    def test_stores_error_code(self):
        exc = AppException(status_code=400, detail="bad", error_code="MY_CODE")
        assert exc.error_code == "MY_CODE"

    def test_default_error_code_is_empty(self):
        exc = AppException(status_code=500, detail="oops")
        assert exc.error_code == ""

    def test_status_code_and_detail(self):
        exc = AppException(status_code=503, detail="unavailable", error_code="SVC")
        assert exc.status_code == 503
        assert exc.detail == "unavailable"


# ─── NotFoundException ────────────────────────────────────────────────────────

class TestNotFoundException:
    def test_defaults(self):
        exc = NotFoundException()
        assert exc.status_code == status.HTTP_404_NOT_FOUND
        assert exc.detail == "Resource not found"
        assert exc.error_code == "NOT_FOUND"

    def test_custom_detail(self):
        exc = NotFoundException(detail="User not found")
        assert exc.detail == "User not found"

    def test_custom_error_code(self):
        exc = NotFoundException(detail="x", error_code="USER_404")
        assert exc.error_code == "USER_404"

    def test_inherits_app_exception(self):
        assert isinstance(NotFoundException(), AppException)


# ─── BadRequestException ─────────────────────────────────────────────────────

class TestBadRequestException:
    def test_defaults(self):
        exc = BadRequestException()
        assert exc.status_code == status.HTTP_400_BAD_REQUEST
        assert exc.detail == "Bad request"
        assert exc.error_code == "BAD_REQUEST"

    def test_custom(self):
        exc = BadRequestException(detail="Invalid input", error_code="INVALID")
        assert exc.detail == "Invalid input"
        assert exc.error_code == "INVALID"

    def test_inherits_app_exception(self):
        assert isinstance(BadRequestException(), AppException)


# ─── UnauthorizedException ────────────────────────────────────────────────────

class TestUnauthorizedException:
    def test_defaults(self):
        exc = UnauthorizedException()
        assert exc.status_code == status.HTTP_401_UNAUTHORIZED
        assert exc.detail == "Unauthorized"
        assert exc.error_code == "UNAUTHORIZED"

    def test_custom(self):
        exc = UnauthorizedException(detail="Token expired", error_code="TOKEN_EXPIRED")
        assert exc.detail == "Token expired"
        assert exc.error_code == "TOKEN_EXPIRED"

    def test_inherits_app_exception(self):
        assert isinstance(UnauthorizedException(), AppException)


# ─── ForbiddenException ──────────────────────────────────────────────────────

class TestForbiddenException:
    def test_defaults(self):
        exc = ForbiddenException()
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.detail == "Forbidden"
        assert exc.error_code == "FORBIDDEN"

    def test_custom(self):
        exc = ForbiddenException(detail="No access", error_code="NO_ACCESS")
        assert exc.detail == "No access"
        assert exc.error_code == "NO_ACCESS"

    def test_inherits_app_exception(self):
        assert isinstance(ForbiddenException(), AppException)


# ─── ConflictException ───────────────────────────────────────────────────────

class TestConflictException:
    def test_defaults(self):
        exc = ConflictException()
        assert exc.status_code == status.HTTP_409_CONFLICT
        assert exc.detail == "Conflict"
        assert exc.error_code == "CONFLICT"

    def test_custom(self):
        exc = ConflictException(detail="Duplicate", error_code="DUPLICATE")
        assert exc.detail == "Duplicate"
        assert exc.error_code == "DUPLICATE"

    def test_inherits_app_exception(self):
        assert isinstance(ConflictException(), AppException)


# ─── TooManyRequestsException ────────────────────────────────────────────────

class TestTooManyRequestsException:
    def test_defaults(self):
        exc = TooManyRequestsException()
        assert exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert exc.detail == "Too many requests"
        assert exc.error_code == "RATE_LIMITED"

    def test_custom(self):
        exc = TooManyRequestsException(detail="Slow down", error_code="THROTTLED")
        assert exc.detail == "Slow down"
        assert exc.error_code == "THROTTLED"

    def test_inherits_app_exception(self):
        assert isinstance(TooManyRequestsException(), AppException)


# ─── LockedAccountException ──────────────────────────────────────────────────

class TestLockedAccountException:
    def test_defaults(self):
        exc = LockedAccountException()
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.detail == "Account is locked"
        assert exc.error_code == "ACCOUNT_LOCKED"

    def test_custom(self):
        exc = LockedAccountException(detail="Banned", error_code="BANNED")
        assert exc.detail == "Banned"
        assert exc.error_code == "BANNED"

    def test_inherits_app_exception(self):
        assert isinstance(LockedAccountException(), AppException)

    def test_is_also_http_exception(self):
        assert isinstance(LockedAccountException(), HTTPException)
