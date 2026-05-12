from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, Request, Query

from app.core.dependencies import get_account_service, require_active_user, get_current_user_id
from app.core.config import get_settings
from app.core.exceptions import BadRequestException
from app.modules.account.service import AccountService
from app.modules.account.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    NotificationSettingsResponse,
    OrderHistoryResponse,
    PrivacySettingsResponse,
    ProfileResponse,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SendOtpRequest,
    TokenResponse,
    UpdateNotificationSettingsRequest,
    UpdatePrivacySettingsRequest,
    UpdateProfileRequest,
    VerifyOtpRequest,
)

router = APIRouter(prefix="/account", tags=["Account"])
settings = get_settings()


# ─── Auth ──────────────────────────────────────────────────────────────────────

@router.post("/register/resend-verification", response_model=MessageResponse)
async def resend_verification_otp(
    body: SendOtpRequest,
    svc: AccountService = Depends(get_account_service),
):
    body.purpose = "register"
    message = await svc.resend_verification_otp(body)
    return MessageResponse(message=message)


@router.post("/register", response_model=MessageResponse)
async def register(
    body: RegisterRequest,
    svc: AccountService = Depends(get_account_service),
):
    message = await svc.register(body)
    return MessageResponse(message=message)


@router.post("/verify-otp", response_model=MessageResponse)
async def verify_otp(
    body: VerifyOtpRequest,
    svc: AccountService = Depends(get_account_service),
):
    message = await svc.verify_otp(body)
    return MessageResponse(message=message)


from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    svc: AccountService = Depends(get_account_service),
):
    ip_address = request.client.host if request.client else "unknown"
    body = LoginRequest(email=form_data.username, password=form_data.password)
    return await svc.login(body, ip_address)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    user_id: str = Depends(require_active_user),
    refresh_token: Optional[str] = None,
    svc: AccountService = Depends(get_account_service),
):
    # Extract access token from header to invalidate specific session
    auth_header = request.headers.get("Authorization")
    access_token = None
    if auth_header and auth_header.startswith("Bearer "):
        access_token = auth_header[7:]
        
    message = await svc.logout(user_id, refresh_token, access_token)
    return MessageResponse(message=message)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshTokenRequest,
    svc: AccountService = Depends(get_account_service),
):
    return await svc.refresh_access_token(body)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    body: SendOtpRequest,
    svc: AccountService = Depends(get_account_service),
):
    body.purpose = "reset_password"
    message = await svc.forgot_password(body)
    return MessageResponse(message=message)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    body: ResetPasswordRequest,
    svc: AccountService = Depends(get_account_service),
):
    message = await svc.reset_password(body)
    return MessageResponse(message=message)


# ─── Profile ───────────────────────────────────────────────────────────────────

@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(
    user_id: str = Depends(require_active_user),
    svc: AccountService = Depends(get_account_service),
):
    return await svc.get_profile(user_id, user_id)

@router.get("/search", response_model=list[ProfileResponse])
async def search_users(
    query: str = Query(...),
    limit: int = Query(10, ge=1, le=50),
    user_id: Optional[str] = Depends(get_current_user_id),
    svc: AccountService = Depends(get_account_service),
):
    return await svc.search_users(query, user_id, limit)


@router.get("/{target_user_id}", response_model=ProfileResponse)
async def get_user_profile(
    target_user_id: str,
    user_id: Optional[str] = Depends(get_current_user_id),
    svc: AccountService = Depends(get_account_service),
):
    return await svc.get_profile(target_user_id, user_id)


@router.put("/me", response_model=ProfileResponse)
async def update_my_profile(
    body: UpdateProfileRequest,
    user_id: str = Depends(require_active_user),
    svc: AccountService = Depends(get_account_service),
):
    return await svc.update_profile(user_id, body)


# --- Privacy (UC-18) ---



@router.put("/me/avatar", response_model=ProfileResponse)
async def update_avatar(
    file: UploadFile = File(...),
    user_id: str = Depends(require_active_user),
    svc: AccountService = Depends(get_account_service),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise BadRequestException("Tập tin phải là hình ảnh", "INVALID_FILE_TYPE")

    content = await file.read()
    max_bytes = settings.MAX_AVATAR_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise BadRequestException(
            f"Ảnh đại diện phải nhỏ hơn {settings.MAX_AVATAR_SIZE_MB}MB", "FILE_TOO_LARGE"
        )

    from app.utils.storage import upload_file
    avatar_url = await upload_file(content, file.filename or "avatar.jpg", f"avatars/{user_id}")
    return await svc.update_avatar(user_id, avatar_url)


@router.put("/me/cover", response_model=ProfileResponse)
async def update_cover(
    file: UploadFile = File(...),
    user_id: str = Depends(require_active_user),
    svc: AccountService = Depends(get_account_service),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise BadRequestException("Tập tin phải là hình ảnh", "INVALID_FILE_TYPE")

    content = await file.read()
    max_bytes = settings.MAX_COVER_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise BadRequestException(
            f"Ảnh bìa phải nhỏ hơn {settings.MAX_COVER_SIZE_MB}MB", "FILE_TOO_LARGE"
        )

    from app.utils.storage import upload_file
    cover_url = await upload_file(content, file.filename or "cover.jpg", f"covers/{user_id}")
    return await svc.update_cover(user_id, cover_url)


@router.put("/me/password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    user_id: str = Depends(require_active_user),
    svc: AccountService = Depends(get_account_service),
):
    message = await svc.change_password(user_id, body)
    return MessageResponse(message=message)


# ─── Privacy Settings ──────────────────────────────────────────────────────────

@router.get("/me/privacy", response_model=PrivacySettingsResponse)
async def get_privacy_settings(
    user_id: str = Depends(require_active_user),
    svc: AccountService = Depends(get_account_service),
):
    return await svc.get_privacy_settings(user_id)


@router.put("/me/privacy", response_model=PrivacySettingsResponse)
async def update_privacy_settings(
    body: UpdatePrivacySettingsRequest,
    user_id: str = Depends(require_active_user),
    svc: AccountService = Depends(get_account_service),
):
    return await svc.update_privacy_settings(user_id, body)


# ─── Notification Settings ─────────────────────────────────────────────────────

@router.get("/me/notification-settings", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    user_id: str = Depends(require_active_user),
    svc: AccountService = Depends(get_account_service),
):
    return await svc.get_notification_settings(user_id)


@router.put("/me/notification-settings", response_model=NotificationSettingsResponse)
async def update_notification_settings(
    body: UpdateNotificationSettingsRequest,
    user_id: str = Depends(require_active_user),
    svc: AccountService = Depends(get_account_service),
):
    return await svc.update_notification_settings(user_id, body)


# ─── Order History ─────────────────────────────────────────────────────────────

@router.get("/me/orders", response_model=OrderHistoryResponse)
async def get_order_history(
    user_id: str = Depends(require_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    svc: AccountService = Depends(get_account_service),
):
    return await svc.get_order_history(user_id, skip, limit)
