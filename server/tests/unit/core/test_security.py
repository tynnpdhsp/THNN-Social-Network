"""
Unit tests for ``app/core/security.py``.

Covers:
- hash_password / verify_password
- create_access_token / create_refresh_token
- decode_token (valid, invalid signature, expired, garbage)
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

import pytest
from jose import jwt

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.config import get_settings

settings = get_settings()


# ─── hash_password / verify_password ──────────────────────────────────────────

class TestHashPassword:
    def test_hash_returns_bcrypt_string(self):
        hashed = hash_password("MyPassword123!")
        assert hashed.startswith("$2b$")

    def test_hash_differs_from_plaintext(self):
        plain = "secret"
        assert hash_password(plain) != plain

    def test_two_hashes_of_same_password_differ(self):
        """bcrypt uses random salt → two hashes must not be identical."""
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2


class TestVerifyPassword:
    def test_correct_password_returns_true(self):
        hashed = hash_password("correct")
        assert verify_password("correct", hashed) is True

    def test_wrong_password_returns_false(self):
        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False

    def test_empty_password_returns_false(self):
        hashed = hash_password("notempty")
        assert verify_password("", hashed) is False

    def test_verify_with_empty_hash_raises(self):
        """passlib should raise on a malformed hash."""
        with pytest.raises(Exception):
            verify_password("anything", "")


# ─── create_access_token ──────────────────────────────────────────────────────

class TestCreateAccessToken:
    def test_contains_sub_claim(self):
        token = create_access_token("user-123")
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["sub"] == "user-123"

    def test_type_is_access(self):
        token = create_access_token("user-123")
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["type"] == "access"

    def test_has_exp_claim(self):
        token = create_access_token("user-123")
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert "exp" in payload

    def test_extra_claims_merged(self):
        token = create_access_token("user-123", extra_claims={"role": "admin"})
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["role"] == "admin"
        assert payload["sub"] == "user-123"

    def test_extra_claims_none_still_works(self):
        token = create_access_token("user-123", extra_claims=None)
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["sub"] == "user-123"

    def test_extra_claims_empty_dict(self):
        token = create_access_token("user-123", extra_claims={})
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["sub"] == "user-123"


# ─── create_refresh_token ─────────────────────────────────────────────────────

class TestCreateRefreshToken:
    def test_type_is_refresh(self):
        token = create_refresh_token("user-456")
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["type"] == "refresh"

    def test_contains_jti(self):
        token = create_refresh_token("user-456")
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert "jti" in payload
        assert len(payload["jti"]) > 0

    def test_jti_unique_across_calls(self):
        t1 = create_refresh_token("user-456")
        t2 = create_refresh_token("user-456")
        p1 = jwt.decode(t1, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        p2 = jwt.decode(t2, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert p1["jti"] != p2["jti"]

    def test_sub_correct(self):
        token = create_refresh_token("user-789")
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["sub"] == "user-789"

    def test_has_exp(self):
        token = create_refresh_token("u")
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert "exp" in payload


# ─── decode_token ─────────────────────────────────────────────────────────────

class TestDecodeToken:
    def test_valid_access_token(self):
        token = create_access_token("user-1")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-1"

    def test_valid_refresh_token(self):
        token = create_refresh_token("user-2")
        payload = decode_token(token)
        assert payload is not None
        assert payload["type"] == "refresh"

    def test_wrong_secret_returns_none(self):
        token = jwt.encode(
            {"sub": "user-x", "type": "access"},
            "wrong-secret",
            algorithm=settings.JWT_ALGORITHM,
        )
        assert decode_token(token) is None

    def test_expired_token_returns_none(self):
        expired = datetime.now(timezone.utc) - timedelta(hours=1)
        token = jwt.encode(
            {"sub": "user-x", "exp": expired, "type": "access"},
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )
        assert decode_token(token) is None

    def test_garbage_string_returns_none(self):
        assert decode_token("not.a.valid.jwt.at.all") is None

    def test_empty_string_returns_none(self):
        assert decode_token("") is None

    def test_random_bytes_returns_none(self):
        import os
        assert decode_token(os.urandom(64).hex()) is None
