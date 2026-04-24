import asyncio
from typing import AsyncGenerator, Dict, Any, Optional
from unittest.mock import MagicMock, AsyncMock

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from prisma import Prisma

from app.main import app
from app.core.dependencies import db
import app.core.redis as redis_core

class MockRedis:
    def __init__(self):
        self.data: Dict[str, str] = {}
        self.expirations: Dict[str, float] = {}

    async def get(self, key: str) -> Optional[str]:
        return self.data.get(key)

    async def set(self, key: str, value: str, ex: Optional[int] = None):
        self.data[key] = str(value)
        return True

    async def incr(self, key: str) -> int:
        val = int(self.data.get(key, 0)) + 1
        self.data[key] = str(val)
        return val

    async def expire(self, key: str, seconds: int):
        return True

    async def delete(self, *keys: str):
        for key in keys:
            self.data.pop(key, None)
        return len(keys)

    async def exists(self, key: str) -> bool:
        return key in self.data

    async def ttl(self, key: str) -> int:
        return 300 # Default TTL for mock

    async def close(self):
        pass

_mock_redis = MockRedis()


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def client() -> AsyncGenerator[AsyncClient, None]:
    # Patch Redis
    original_get_redis = redis_core.get_redis
    original_close_redis = redis_core.close_redis
    redis_core.get_redis = AsyncMock(return_value=_mock_redis)
    redis_core.close_redis = AsyncMock()

    # Ensure DB is connected before starting
    if not db.is_connected():
        await db.connect()

    transport = ASGITransport(app=app)
    # Set timeout=None to detect if it's a deadlock or just slow
    async with AsyncClient(transport=transport, base_url="http://test", timeout=None) as c:
        yield c
    
    if db.is_connected():
        await db.disconnect()
    # Restore Redis
    redis_core.get_redis = original_get_redis
    redis_core.close_redis = original_close_redis


@pytest_asyncio.fixture
async def registered_user(client: AsyncClient) -> dict:
    """Create a test user and return {email, password, user_id, access_token, refresh_token}."""
    email = "test_user@example.com"
    password = "TestPass123!"
    otp_code = "123456"

    # Pre-populate MockRedis with the expected OTP for registration
    import json
    otp_data = json.dumps({"code": otp_code, "attempts": 0, "max_attempts": 3})
    _mock_redis.data[f"auth:otp:{email}:register"] = otp_data

    resp = await client.post("/api/v1/account/register", json={
        "email": email,
        "password": password,
        "confirm_password": password,
        "full_name": "Test User",
        "phone_number": "0901234567",
        "code": otp_code
    })
    # If already registered, just login
    if resp.status_code == 409:
        resp = await client.post("/api/v1/account/login", json={
            "email": email,
            "password": password,
        })

    data = resp.json()
    return {
        "email": email,
        "password": password,
        "access_token": data.get("access_token", ""),
        "refresh_token": data.get("refresh_token", ""),
    }


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
