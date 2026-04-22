import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from prisma import Prisma

from app.main import app, db


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def client() -> AsyncGenerator[AsyncClient, None]:
    await db.connect()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await db.disconnect()


@pytest_asyncio.fixture
async def registered_user(client: AsyncClient) -> dict:
    """Create a test user and return {email, password, user_id, access_token, refresh_token}."""
    email = "test_user@example.com"
    password = "TestPass123!"

    resp = await client.post("/api/v1/account/register", json={
        "email": email,
        "password": password,
        "confirm_password": password,
        "full_name": "Test User",
        "phone_number": "0901234567",
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
