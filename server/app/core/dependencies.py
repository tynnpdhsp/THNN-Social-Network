from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from prisma import Prisma

from app.core.security import decode_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.modules.account.repository import AccountRepository
from app.modules.account.service import AccountService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/account/login")

_db: Prisma | None = None


def get_db() -> Prisma:
    global _db
    if _db is None:
        _db = Prisma(auto_register=True)
    return _db


def get_account_repo(db: Prisma = Depends(get_db)) -> AccountRepository:
    return AccountRepository(db)


def get_account_service(
    repo: AccountRepository = Depends(get_account_repo),
) -> AccountService:
    return AccountService(repo)


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
