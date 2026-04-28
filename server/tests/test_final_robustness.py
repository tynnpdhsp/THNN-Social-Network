import pytest
from httpx import AsyncClient
from tests.conftest import auth_headers

@pytest.mark.asyncio
async def test_search_robustness(client: AsyncClient, registered_user: dict):
    """Verify user search (fixed 500 error and MongoDB OR bug)"""
    headers = auth_headers(registered_user["access_token"])
    
    # 1. Search by name (contains 'Sinh')
    response = await client.get("/api/v1/account/search?query=Sinh", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Seed data has 'Sinh Viên X'
    assert len(data) > 0
    # Ensure role is present (fixed validation error)
    assert "role" in data[0]
    assert "full_name" in data[0]

    # 2. Search by email fragment
    response = await client.get("/api/v1/account/search?query=student", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) > 0

@pytest.mark.asyncio
async def test_social_feed_visibility(client: AsyncClient, registered_user: dict):
    """Verify social feed (fixed deletedAt missing field bug and 405 error)"""
    headers = auth_headers(registered_user["access_token"])
    
    # Test new /feed endpoint
    response = await client.get("/api/v1/social/feed?limit=10", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "posts" in data
    # Should find seeded posts even if deletedAt is missing in DB
    assert len(data["posts"]) > 0
    
    # Verify author mapping (UserInfoEmbed)
    post = data["posts"][0]
    assert "user_info" in post
    assert "full_name" in post["user_info"]
    assert post["user_info"]["full_name"] is not None

@pytest.mark.asyncio
async def test_messaging_sync(client: AsyncClient, registered_user: dict):
    """Verify messaging module sync"""
    headers = auth_headers(registered_user["access_token"])
    
    # 1. List conversations
    response = await client.get("/api/v1/messaging/conversations", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "conversations" in data
    convs = data["conversations"]
    assert isinstance(convs, list)
    
    # 2. If there are conversations (from seed), check messages
    if len(convs) > 0:
        conv_id = convs[0]["id"]
        res_msg = await client.get(f"/api/v1/messaging/conversations/{conv_id}/messages", headers=headers)
        assert res_msg.status_code == 200
        msg_data = res_msg.json()
        assert "messages" in msg_data
        assert isinstance(msg_data["messages"], list)

@pytest.mark.asyncio
async def test_board_posts(client: AsyncClient, registered_user: dict):
    """Verify board posts (ensure shared repository logic also works for board)"""
    headers = auth_headers(registered_user["access_token"])
    
    response = await client.get("/api/v1/board/posts", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "posts" in data
    # Seeding creates some board posts
    assert len(data["posts"]) > 0
