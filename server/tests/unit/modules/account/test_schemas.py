"""
Unit tests for ``app/modules/account/schemas.py`` (Sprint 2 / Phase B).

Validation rules for auth, profile, and settings request models.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.modules.account.schemas import (
    RegisterRequest,
    VerifyOtpRequest,
    SendOtpRequest,
    LoginRequest,
    ResetPasswordRequest,
    ChangePasswordRequest,
    UpdateProfileRequest,
    UpdatePrivacySettingsRequest,
    UpdateNotificationSettingsRequest,
    ProfileResponse,
)


class TestRegisterRequest:
    def test_valid(self):
        r = RegisterRequest(
            email="a@b.com",
            password="password1",
            confirm_password="password1",
            full_name="Nguyen Van A",
            phone_number="0901234567",
        )
        assert r.email == "a@b.com"
        assert r.phone_number == "0901234567"

    def test_passwords_mismatch(self):
        with pytest.raises(ValidationError) as exc:
            RegisterRequest(
                email="a@b.com",
                password="password1",
                confirm_password="password2",
                full_name="A",
                phone_number="0901234567",
            )
        assert "Passwords do not match" in str(exc.value)

    def test_password_too_short(self):
        with pytest.raises(ValidationError):
            RegisterRequest(
                email="a@b.com",
                password="short",
                confirm_password="short",
                full_name="A",
                phone_number="0901234567",
            )

    def test_password_too_long(self):
        pw = "x" * 129
        with pytest.raises(ValidationError):
            RegisterRequest(
                email="a@b.com",
                password=pw,
                confirm_password=pw,
                full_name="A",
                phone_number="0901234567",
            )

    def test_phone_too_short(self):
        with pytest.raises(ValidationError):
            RegisterRequest(
                email="a@b.com",
                password="password1",
                confirm_password="password1",
                full_name="A",
                phone_number="090123456",  # 9 digits
            )

    def test_phone_too_long(self):
        with pytest.raises(ValidationError):
            RegisterRequest(
                email="a@b.com",
                password="password1",
                confirm_password="password1",
                full_name="A",
                phone_number="012345678901",  # 12 chars
            )

    def test_full_name_empty(self):
        with pytest.raises(ValidationError):
            RegisterRequest(
                email="a@b.com",
                password="password1",
                confirm_password="password1",
                full_name="",
                phone_number="0901234567",
            )

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            RegisterRequest(
                email="not-an-email",
                password="password1",
                confirm_password="password1",
                full_name="A",
                phone_number="0901234567",
            )


class TestVerifyOtpRequest:
    def test_register_purpose(self):
        v = VerifyOtpRequest(email="a@b.com", code="123456", purpose="register")
        assert v.purpose == "register"

    def test_reset_password_purpose(self):
        v = VerifyOtpRequest(email="a@b.com", code="000000", purpose="reset_password")
        assert v.purpose == "reset_password"

    def test_invalid_purpose(self):
        with pytest.raises(ValidationError):
            VerifyOtpRequest(email="a@b.com", code="123456", purpose="login")

    def test_code_wrong_length_short(self):
        with pytest.raises(ValidationError):
            VerifyOtpRequest(email="a@b.com", code="12345", purpose="register")

    def test_code_wrong_length_long(self):
        with pytest.raises(ValidationError):
            VerifyOtpRequest(email="a@b.com", code="1234567", purpose="register")


class TestSendOtpRequest:
    def test_register(self):
        s = SendOtpRequest(email="x@y.com", purpose="register")
        assert s.purpose == "register"

    def test_reset_password(self):
        s = SendOtpRequest(email="x@y.com", purpose="reset_password")
        assert s.purpose == "reset_password"

    def test_invalid_purpose(self):
        with pytest.raises(ValidationError):
            SendOtpRequest(email="x@y.com", purpose="verify_email")


class TestLoginRequest:
    def test_valid(self):
        LoginRequest(email="u@u.com", password="anything")


class TestResetPasswordRequest:
    def test_valid(self):
        ResetPasswordRequest(email="a@b.com", code="123456", new_password="newpass12")

    def test_new_password_too_short(self):
        with pytest.raises(ValidationError):
            ResetPasswordRequest(email="a@b.com", code="123456", new_password="short")


class TestChangePasswordRequest:
    def test_valid(self):
        ChangePasswordRequest(current_password="old", new_password="newpass12")

    def test_new_password_too_short(self):
        with pytest.raises(ValidationError):
            ChangePasswordRequest(current_password="old", new_password="short")


class TestUpdateProfileRequest:
    def test_all_none_valid(self):
        UpdateProfileRequest()

    def test_phone_bounds(self):
        UpdateProfileRequest(phone_number="0901234567")
        with pytest.raises(ValidationError):
            UpdateProfileRequest(phone_number="123")

    def test_bio_max_length(self):
        UpdateProfileRequest(bio="x" * 500)
        with pytest.raises(ValidationError):
            UpdateProfileRequest(bio="x" * 501)


class TestUpdatePrivacySettingsRequest:
    def test_each_field_valid(self):
        UpdatePrivacySettingsRequest(who_can_see_posts="only_me")
        UpdatePrivacySettingsRequest(who_can_message="friends")
        UpdatePrivacySettingsRequest(who_can_friend_req="friends_of_friends")

    def test_invalid_who_can_see_posts(self):
        with pytest.raises(ValidationError):
            UpdatePrivacySettingsRequest(who_can_see_posts="public")

    def test_invalid_who_can_friend_req(self):
        with pytest.raises(ValidationError):
            UpdatePrivacySettingsRequest(who_can_friend_req="friends")

    def test_all_none_ok(self):
        UpdatePrivacySettingsRequest()


class TestUpdateNotificationSettingsRequest:
    def test_partial_bools(self):
        u = UpdateNotificationSettingsRequest(notify_like=False)
        assert u.notify_like is False
        assert u.notify_comment is None


class TestProfileResponse:
    def test_model_validate_from_dict(self):
        p = ProfileResponse.model_validate(
            {
                "id": "u1",
                "email": "e@e.com",
                "full_name": "N",
                "phone_number": "0901234567",
                "bio": None,
                "avatar_url": None,
                "cover_url": None,
                "role": "student",
                "email_verified": True,
                "created_at": datetime(2025, 1, 1, tzinfo=timezone.utc),
                "friend_status": "none",
            }
        )
        assert p.id == "u1"
        assert p.friend_status == "none"
