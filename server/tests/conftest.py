import asyncio
import json
from typing import AsyncGenerator, Dict, Any, List, Optional
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
import os

# Increase Prisma timeout for Windows stability
os.environ["PRISMA_CLIENT_TIMEOUT"] = "60"

from app.main import app
from app.core.dependencies import db
import app.core.redis as redis_core
import app.utils.email as email_utils
import app.modules.account.service as account_svc_module


class MockRedis:
    """In-memory mock that covers string, hash, and sorted-set commands."""

    def __init__(self):
        self.data: Dict[str, Any] = {}

    # --- String ---
    async def get(self, key: str) -> Optional[str]:
        val = self.data.get(key)
        return val if isinstance(val, str) else None

    async def set(self, key: str, value: str, ex: Optional[int] = None):
        self.data[key] = str(value)
        return True

    async def incr(self, key: str) -> int:
        val = int(self.data.get(key, 0)) + 1
        self.data[key] = str(val)
        return val

    # --- Hash ---
    async def hset(self, key: str, field: str, value: str):
        if key not in self.data or not isinstance(self.data[key], dict):
            self.data[key] = {}
        self.data[key][field] = str(value)
        return 1

    async def hget(self, key: str, field: str) -> Optional[str]:
        h = self.data.get(key)
        if isinstance(h, dict):
            return h.get(field)
        return None

    async def hgetall(self, key: str) -> Dict[str, str]:
        h = self.data.get(key)
        return h if isinstance(h, dict) else {}

    async def hincrby(self, key: str, field: str, amount: int = 1) -> int:
        if key not in self.data or not isinstance(self.data[key], dict):
            self.data[key] = {}
        current = int(self.data[key].get(field, 0))
        new_val = current + amount
        self.data[key][field] = str(new_val)
        return new_val

    # --- Sorted Set ---
    async def zadd(self, key: str, mapping: Dict[str, float]):
        if key not in self.data or not isinstance(self.data[key], dict):
            self.data[key] = {}
        for member, score in mapping.items():
            self.data[key][member] = score
        return len(mapping)

    async def zrevrange(self, key: str, start: int, end: int) -> List[str]:
        zset = self.data.get(key)
        if not isinstance(zset, dict):
            return []
        sorted_members = sorted(zset.items(), key=lambda x: x[1], reverse=True)
        return [m for m, _ in sorted_members[start:end + 1]]

    async def zremrangebyrank(self, key: str, start: int, end: int) -> int:
        zset = self.data.get(key)
        if not isinstance(zset, dict):
            return 0
        sorted_members = sorted(zset.items(), key=lambda x: x[1])
        to_remove = sorted_members[start:end + 1] if end >= 0 else sorted_members[start:]
        for member, _ in to_remove:
            zset.pop(member, None)
        return len(to_remove)

    # --- Key ops ---
    async def expire(self, key: str, seconds: int):
        return True

    async def delete(self, *keys: str):
        for key in keys:
            self.data.pop(key, None)
        return len(keys)

    async def exists(self, key: str) -> bool:
        return key in self.data

    async def ttl(self, key: str) -> int:
        return 300

    async def close(self):
        pass


_mock_redis = MockRedis()


@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop for all async tests."""
    import sys
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def client() -> AsyncGenerator[AsyncClient, None]:
    # Inject MockRedis as the module-level singleton
    # All modules that do `from app.core.redis import get_redis` will
    # return _mock_redis since get_redis() checks _redis first.
    redis_core._redis = _mock_redis

    # Patch email sending (no real SMTP in tests)
    original_send_otp_email = email_utils.send_otp_email
    mock_send = AsyncMock()
    email_utils.send_otp_email = mock_send
    account_svc_module.send_otp_email = mock_send

    if not db.is_connected():
        await db.connect()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", timeout=60.0) as c:
        yield c

    # Cleanup: disconnect Prisma BEFORE event loop closes
    try:
        if db.is_connected():
            await db.disconnect()
    except RuntimeError:
        pass  # Event loop closing — ignore

    redis_core._redis = None
    email_utils.send_otp_email = original_send_otp_email
    account_svc_module.send_otp_email = original_send_otp_email


@pytest_asyncio.fixture(scope="session")
async def registered_user(client: AsyncClient) -> dict:
    """Create a test user once per session and return credentials + tokens."""
    from app.core.security import hash_password

    email = "test_user@example.com"
    password = "TestPass123!"

    # Check if user already exists (from previous test run)
    user = await db.user.find_first(where={"email": email})

    if not user:
        # Register new user
        await client.post("/api/v1/account/register", json={
            "email": email,
            "password": password,
            "confirm_password": password,
            "full_name": "Test User",
            "phone_number": "0901234567",
        })
        user = await db.user.find_first(where={"email": email})

    # Always reset to known state (password may have been changed by previous tests)
    if user:
        await db.user.update(
            where={"id": user.id},
            data={
                "emailVerified": True,
                "passwordHash": hash_password(password),
                "isLocked": False,
            },
        )

    # Login with form data (OAuth2PasswordRequestForm)
    login_resp = await client.post("/api/v1/account/login", data={
        "username": email,
        "password": password,
    })

    if login_resp.status_code != 200:
        pytest.fail(f"Login failed: {login_resp.status_code} {login_resp.text}")

    data = login_resp.json()
    return {
        "email": email,
        "password": password,
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
    }


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
