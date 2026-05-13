"""
Unit tests for ``app/utils/otp.py``.

Covers:
- Default length (6 digits)
- Custom length
- Only digit characters
- Variability (not always the same)
"""

from __future__ import annotations

import pytest

from app.utils.otp import generate_otp


class TestGenerateOtp:
    def test_default_length_is_6(self):
        otp = generate_otp()
        assert len(otp) == 6

    def test_custom_length_4(self):
        otp = generate_otp(length=4)
        assert len(otp) == 4

    def test_custom_length_8(self):
        otp = generate_otp(length=8)
        assert len(otp) == 8

    def test_custom_length_1(self):
        otp = generate_otp(length=1)
        assert len(otp) == 1

    def test_only_digits(self):
        for _ in range(50):
            otp = generate_otp()
            assert otp.isdigit(), f"OTP contains non-digit: {otp}"

    def test_variability_across_calls(self):
        """Generate many OTPs; at least 2 must be unique to prove randomness."""
        otps = {generate_otp() for _ in range(20)}
        assert len(otps) > 1, "All OTPs are identical — randomness issue"

    def test_length_0_returns_empty(self):
        otp = generate_otp(length=0)
        assert otp == ""

    def test_negative_length_returns_empty(self):
        """``range(n)`` for negative *n* is empty → concatenation yields ``\"\"``."""
        otp = generate_otp(length=-1)
        assert otp == ""

    def test_large_length_all_digits(self):
        otp = generate_otp(length=32)
        assert len(otp) == 32
        assert otp.isdigit()
