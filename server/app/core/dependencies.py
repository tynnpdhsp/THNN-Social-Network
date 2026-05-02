from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from prisma import Prisma

from app.core.security import decode_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.modules.account.repository import AccountRepository
from app.modules.account.service import AccountService
from app.modules.social.repository import SocialRepository
from app.modules.social.service import SocialService
from app.modules.shop.repository import ShopRepository
from app.modules.shop.service import ShopService

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


async def get_current_user_id(token: Annotated[str, Depends(oauth2_scheme)]) -> str:
    payload = decode_token(token)
    if payload is None:
        raise UnauthorizedException("Invalid or expired token", "INVALID_TOKEN")
    if payload.get("type") != "access":
        raise UnauthorizedException("Invalid token type", "INVALID_TOKEN_TYPE")
    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedException("Invalid token payload", "INVALID_TOKEN_PAYLOAD")
    return user_id


async def require_active_user(
    user_id: str = Depends(get_current_user_id),
    repo: AccountRepository = Depends(get_account_repo),
) -> str:
    user = await repo.get_user_by_id(user_id)
    if user is None:
        raise UnauthorizedException("User not found", "USER_NOT_FOUND")
    if user.isLocked:
        raise ForbiddenException("Account is locked", "ACCOUNT_LOCKED")
    if user.deletedAt is not None:
        raise UnauthorizedException("Account is deactivated", "ACCOUNT_DEACTIVATED")
    return user_id


# --- Social Network ---

def get_social_repo(db: Prisma = Depends(get_db)) -> SocialRepository:
    return SocialRepository(db)


def get_social_service(
    repo: SocialRepository = Depends(get_social_repo),
) -> SocialService:
    return SocialService(repo)

# --- Shop ---
def get_shop_repo(db: Prisma = Depends(get_db)) -> ShopRepository:
    return ShopRepository(db)

def get_shop_service(
    repo: ShopRepository = Depends(get_shop_repo),
) -> ShopService:
    return ShopService(repo)