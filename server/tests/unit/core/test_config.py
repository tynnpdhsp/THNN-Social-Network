"""
Unit tests for ``app/core/config.py``.

Covers:
- Settings defaults
- get_settings() returns cached instance (lru_cache)
- validate_security: DEBUG=False + default JWT_SECRET_KEY → ValueError
- validate_security: valid combinations pass
"""

from __future__ import annotations

import pytest

# We need to test Settings directly — NOT the cached singleton
from app.core.config import Settings


class TestSettingsDefaults:
    """Verify that default values are sensible when env vars are absent."""

    def test_app_name_default(self):
        s = Settings(DEBUG=True, _env_file=None)
        assert s.APP_NAME == "THNN Social Network"

    def test_jwt_algorithm_default(self):
        s = Settings(DEBUG=True, _env_file=None)
        assert s.JWT_ALGORITHM == "HS256"

    def test_otp_length_default(self):
        s = Settings(DEBUG=True, _env_file=None)
        assert s.OTP_LENGTH == 6

    def test_otp_max_attempts_default(self):
        s = Settings(DEBUG=True, _env_file=None)
        assert s.OTP_MAX_ATTEMPTS == 3

    def test_access_token_expire_default(self):
        s = Settings(DEBUG=True, _env_file=None)
        assert s.ACCESS_TOKEN_EXPIRE_MINUTES == 30

    def test_refresh_token_expire_default(self):
        s = Settings(DEBUG=True, _env_file=None)
        assert s.REFRESH_TOKEN_EXPIRE_DAYS == 30


class TestValidateSecurity:
    """The model_validator ``validate_security`` must reject insecure
    production configurations."""

    def test_debug_false_default_secret_raises(self):
        """Non-debug mode with the placeholder JWT secret must raise."""
        with pytest.raises(ValueError, match="JWT_SECRET_KEY must be set"):
            Settings(
                DEBUG=False,
                JWT_SECRET_KEY="change-me-in-production",
                _env_file=None,
            )

    def test_debug_true_default_secret_ok(self):
        """Debug mode tolerates the placeholder secret."""
        s = Settings(
            DEBUG=True,
            JWT_SECRET_KEY="change-me-in-production",
            _env_file=None,
        )
        assert s.JWT_SECRET_KEY == "change-me-in-production"

    def test_debug_false_real_secret_ok(self):
        """Non-debug mode with a real secret must pass validation."""
        s = Settings(
            DEBUG=False,
            JWT_SECRET_KEY="my-super-secure-production-key-2025",
            _env_file=None,
        )
        assert s.JWT_SECRET_KEY == "my-super-secure-production-key-2025"

    def test_debug_true_real_secret_ok(self):
        s = Settings(
            DEBUG=True,
            JWT_SECRET_KEY="any-key",
            _env_file=None,
        )
        assert s.DEBUG is True

    def test_debug_false_non_default_secret_even_if_similar_passes(self):
        """Any JWT secret different from the exact placeholder is accepted when DEBUG is False."""
        s = Settings(
            DEBUG=False,
            JWT_SECRET_KEY="change-me-in-production-x",
            _env_file=None,
        )
        assert s.JWT_SECRET_KEY == "change-me-in-production-x"


class TestGetSettings:
    """``get_settings`` is decorated with ``@lru_cache`` so it must return
    the same object on repeated calls."""

    def test_returns_same_instance(self):
        from app.core.config import get_settings

        s1 = get_settings()
        s2 = get_settings()
        assert s1 is s2

    def test_returns_settings_instance(self):
        from app.core.config import get_settings

        s = get_settings()
        assert isinstance(s, Settings)

    def test_cache_clear_returns_new_instance(self):
        """After ``cache_clear``, the next call must build a fresh ``Settings``."""
        from app.core.config import get_settings

        s1 = get_settings()
        get_settings.cache_clear()
        s2 = get_settings()
        assert s1 is not s2
        assert isinstance(s2, Settings)
