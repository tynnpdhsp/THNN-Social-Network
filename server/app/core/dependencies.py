from typing import Annotated

from fastapi import Depends # type: ignore
from fastapi.security import OAuth2PasswordBearer # type: ignore

from prisma import Prisma

from app.core.security import decode_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.modules.account.repository import AccountRepository
from app.modules.account.service import AccountService
from app.modules.social.repository import SocialRepository
from app.modules.social.service import SocialService
from app.modules.notification.repository import NotificationRepository
from app.modules.notification.service import NotificationService
from app.modules.admin.repository import AdminRepository
from app.modules.admin.service import AdminService
from app.modules.shop.repository import ShopRepository
from app.modules.shop.service import ShopService
from app.modules.documents.repository import DocumentRepository
from app.modules.documents.service import DocumentService
from app.modules.schedule.service import ScheduleService
from app.modules.schedule.repository import ScheduleRepository
from app.modules.place.repository import PlaceRepository
from app.modules.place.service import PlaceService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/account/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/account/login", auto_error=False)

_db: Prisma | None = None


def get_db() -> Prisma:
    global _db
    if _db is None:
        try:
            _db = Prisma(auto_register=True)
        except Exception:
            # Fallback if already registered by another instance (though we aim to avoid this)
            from prisma import get_client
            _db = get_client()
    return _db


db = get_db()


def get_account_repo(db: Prisma = Depends(get_db)) -> AccountRepository:
    return AccountRepository(db)


def get_account_service(
    repo: AccountRepository = Depends(get_account_repo),
) -> AccountService:
    return AccountService(repo)


async def get_optional_user_id(token: Annotated[str | None, Depends(oauth2_scheme_optional)]) -> str | None:
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload and payload.get("type") == "access":
            return payload.get("sub")
    except Exception:
        pass
    return None


async def get_current_user_id(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> str:
    """Xác thực JWT token và trả về user_id."""
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise UnauthorizedException(
            "Mã xác thực không hợp lệ hoặc đã hết hạn", "INVALID_TOKEN"
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Mã xác thực không hợp lệ", "INVALID_TOKEN")
    
    return user_id


async def require_active_user(
    user_id: str = Depends(get_current_user_id),
    repo: AccountRepository = Depends(get_account_repo),
) -> str:
    """Yêu cầu user phải đang hoạt động (không bị khóa, đã verify email)."""
    user = await repo.get_user_by_id(user_id)
    if user is None or user.deletedAt is not None:
        raise UnauthorizedException("Người dùng không tồn tại", "USER_NOT_FOUND")
    
    if user.isLocked:
        raise ForbiddenException(
            user.lockReason or "Tài khoản của bạn đã bị khóa", "ACCOUNT_LOCKED"
        )
        
    if not user.emailVerified:
        raise ForbiddenException("Vui lòng xác thực email của bạn", "EMAIL_NOT_VERIFIED")
        
    return user_id


# --- Notification ---

def get_notification_repo(db: Prisma = Depends(get_db)) -> NotificationRepository:
    return NotificationRepository(db)


def get_notification_service(
    repo: NotificationRepository = Depends(get_notification_repo),
) -> NotificationService:
    return NotificationService(repo)


# --- Social Network ---

def get_social_repo(db: Prisma = Depends(get_db)) -> SocialRepository:
    return SocialRepository(db)

def get_social_service(
    repo: SocialRepository = Depends(get_social_repo),
    notification_svc: NotificationService = Depends(get_notification_service),
) -> SocialService:
    return SocialService(repo, notification_svc)


# --- Admin Dashboard ---

def get_admin_repo(db: Prisma = Depends(get_db)) -> AdminRepository:
    return AdminRepository(db)


def get_admin_service(
    repo: AdminRepository = Depends(get_admin_repo),
) -> AdminService:
    return AdminService(repo)


async def require_admin(
    user_id: str = Depends(get_current_user_id),
    repo: AccountRepository = Depends(get_account_repo),
) -> str:
    user = await repo.db.user.find_unique(
        where={"id": user_id},
        include={"roleRef": True}
    )
    if user is None:
        raise UnauthorizedException("User not found", "USER_NOT_FOUND")
    
    # Check if admin
    if user.roleRef and user.roleRef.role == "admin":
        return user_id
        
    raise ForbiddenException("Admin privileges required", "ADMIN_REQUIRED")

# --- Shop ---
def get_shop_repo(db: Prisma = Depends(get_db)) -> ShopRepository:
    return ShopRepository(db)

def get_shop_service(
    repo: ShopRepository = Depends(get_shop_repo),
) -> ShopService:
    return ShopService(repo)

# --- document ----
def get_document_repo(db: Prisma=Depends(get_db)) -> DocumentRepository:
    return DocumentRepository(db)

def get_document_service(repo: DocumentRepository=Depends(get_document_repo)) -> DocumentService:
    return DocumentService(repo)

# --- schedule ----
def get_schedule_repo(db: Prisma=Depends(get_db)) -> ScheduleRepository:
    return ScheduleRepository(db)

def get_schedule_service(repo: ScheduleRepository=Depends(get_schedule_repo)) -> ScheduleService:
    return ScheduleService(repo)

# --- place ----
def get_place_repo(db: Prisma=Depends(get_db)) -> PlaceRepository:
    return PlaceRepository(db)

def get_place_service(repo: PlaceRepository=Depends(get_place_repo)) -> PlaceService:
    return PlaceService(repo)