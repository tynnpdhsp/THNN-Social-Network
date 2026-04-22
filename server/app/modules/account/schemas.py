from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ─── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=150)
    phone_number: str = Field(min_length=10, max_length=11)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    purpose: str = Field(pattern="^(register|reset_password)$")


class SendOtpRequest(BaseModel):
    email: EmailStr
    purpose: str = Field(pattern="^(register|reset_password)$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


# ─── Profile ──────────────────────────────────────────────────────────────────

class ProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone_number: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    role: str
    email_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=150)
    bio: Optional[str] = Field(None, max_length=500)
    phone_number: Optional[str] = Field(None, min_length=10, max_length=11)


# ─── Settings ─────────────────────────────────────────────────────────────────

class PrivacySettingsResponse(BaseModel):
    who_can_see_posts: str
    who_can_message: str
    who_can_friend_req: str

    model_config = {"from_attributes": True}


class UpdatePrivacySettingsRequest(BaseModel):
    who_can_see_posts: Optional[str] = Field(None, pattern="^(everyone|friends|only_me)$")
    who_can_message: Optional[str] = Field(None, pattern="^(everyone|friends|only_me)$")
    who_can_friend_req: Optional[str] = Field(None, pattern="^(everyone|friends_of_friends|no_one)$")


class NotificationSettingsResponse(BaseModel):
    notify_like: bool
    notify_comment: bool
    notify_reply: bool
    notify_friend_req: bool
    notify_message: bool
    notify_schedule: bool

    model_config = {"from_attributes": True}


class UpdateNotificationSettingsRequest(BaseModel):
    notify_like: Optional[bool] = None
    notify_comment: Optional[bool] = None
    notify_reply: Optional[bool] = None
    notify_friend_req: Optional[bool] = None
    notify_message: Optional[bool] = None
    notify_schedule: Optional[bool] = None


# ─── Order History ────────────────────────────────────────────────────────────

class OrderHistoryItem(BaseModel):
    id: str
    item_title: str
    amount: float
    status: str
    paid_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class OrderHistoryResponse(BaseModel):
    orders: list[OrderHistoryItem]
    total: int


# ─── Common ───────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
