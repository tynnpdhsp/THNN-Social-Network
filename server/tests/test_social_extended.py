import pytest
import pytest_asyncio
from httpx import AsyncClient

def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

@pytest_asyncio.fixture
async def second_user(client: AsyncClient) -> dict:
    """Create a second test user via API."""
    email = "second_user@example.com"
    password = "SecondPass123!"
    
    # Register (ignore error if exists)
    await client.post("/api/v1/account/register", json={
        "email": email,
        "password": password,
        "confirm_password": password,
        "full_name": "Second User",
        "phone_number": "0902222222",
    })
    
    # Login
    login_resp = await client.post("/api/v1/account/login", data={
        "username": email,
        "password": password,
    })
    data = login_resp.json()
    
    # Get ID via /me
    me_resp = await client.get("/api/v1/account/me", headers=auth_headers(data["access_token"]))
    user_id = me_resp.json()["id"]
    
    return {
        "id": user_id,
        "access_token": data["access_token"]
    }

@pytest.mark.asyncio
async def test_friendship_flow(client: AsyncClient, registered_user: dict, second_user: dict):
    headers_a = auth_headers(registered_user["access_token"])
    headers_b = auth_headers(second_user["access_token"])
    user_b_id = second_user["id"]
    
    # Get A's ID
    me_a = await client.get("/api/v1/account/me", headers=headers_a)
    user_a_id = me_a.json()["id"]

    import asyncio
    # 1. A sends request to B
    resp = await client.post(f"/api/v1/social/friends/requests/{user_b_id}", headers=headers_a)
    assert resp.status_code == 200
    await asyncio.sleep(0.5)
    
    # 2. B lists incoming
    resp = await client.get("/api/v1/social/friends/requests", headers=headers_b)
    assert resp.status_code == 200
    requests = resp.json()
    assert any(r["from"] == user_a_id for r in requests)
    await asyncio.sleep(0.5)

    # 3. B accepts A
    resp = await client.post(f"/api/v1/social/friends/requests/{user_a_id}/accept", headers=headers_b)
    assert resp.status_code == 200
    await asyncio.sleep(0.5)

    # 4. Check friend list
    resp = await client.get("/api/v1/social/friends", headers=headers_a)
    assert resp.status_code == 200
    assert user_b_id in resp.json()
    await asyncio.sleep(0.5)

    # 5. A unfriends B
    resp = await client.delete(f"/api/v1/social/friends/{user_b_id}", headers=headers_a)
    assert resp.status_code == 200
    await asyncio.sleep(0.5)
    
    # 6. Verify unfriended
    resp = await client.get("/api/v1/social/friends", headers=headers_a)
    assert user_b_id not in resp.json()

@pytest.mark.asyncio
async def test_blocking_flow(client: AsyncClient, registered_user: dict, second_user: dict):
    headers_a = auth_headers(registered_user["access_token"])
    user_b_id = second_user["id"]

    import asyncio
    # 1. A blocks B
    resp = await client.post(f"/api/v1/social/blocks/{user_b_id}", headers=headers_a)
    assert resp.status_code == 200
    await asyncio.sleep(0.5)

    # 2. A lists blocked
    resp = await client.get("/api/v1/social/blocks", headers=headers_a)
    assert user_b_id in resp.json()
    await asyncio.sleep(0.5)

    # 3. A unblocks B
    resp = await client.delete(f"/api/v1/social/blocks/{user_b_id}", headers=headers_a)
    assert resp.status_code == 200
    await asyncio.sleep(0.5)

    # 4. Verify unblocked
    resp = await client.get("/api/v1/social/blocks", headers=headers_a)
    assert user_b_id not in resp.json()

@pytest.mark.asyncio
async def test_reporting_flow(client: AsyncClient, registered_user: dict, second_user: dict):
    headers_a = auth_headers(registered_user["access_token"])
    user_b_id = second_user["id"]

    # Report User B
    resp = await client.post(
        f"/api/v1/social/reports/user/{user_b_id}", 
        params={"reason": "Spam", "description": "Too many messages"},
        headers=headers_a
    )
    assert resp.status_code == 200
    assert "report_id" in resp.json()
