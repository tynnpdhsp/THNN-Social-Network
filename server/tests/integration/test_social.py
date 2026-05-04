import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_social_flow(client: AsyncClient, registered_user: dict):
    headers = auth_headers(registered_user["access_token"])

    # 1. Create Post
    resp = await client.post("/api/v1/social/posts",
        json={
            "content": "Test post content",
            "visibility": "public",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    post = resp.json()
    post_id = post["id"]
    assert post["content"] == "Test post content"

    # 2. Get Feed (now paginated)
    resp = await client.get("/api/v1/social/posts")
    assert resp.status_code == 200
    feed = resp.json()
    assert "posts" in feed
    assert "total" in feed
    assert any(p["id"] == post_id for p in feed["posts"])

    # 3. Toggle Like
    resp = await client.post(f"/api/v1/social/posts/{post_id}/like", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["liked"] is True

    # 4. Add Comment
    resp = await client.post(f"/api/v1/social/posts/{post_id}/comments",
        json={"content": "Top level comment"},
        headers=headers,
    )
    assert resp.status_code == 200
    comment = resp.json()
    comment_id = comment["id"]

    # 5. Add Reply (Level 2)
    resp = await client.post(f"/api/v1/social/posts/{post_id}/comments",
        json={
            "content": "Nested reply",
            "parent_comment_id": comment_id,
        },
        headers=headers,
    )
    assert resp.status_code == 200
    updated_comment = resp.json()
    assert len(updated_comment["replies"]) == 1
    assert updated_comment["replies"][0]["content"] == "Nested reply"

    # 6. Delete Post
    resp = await client.delete(f"/api/v1/social/posts/{post_id}", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_privacy_filter_anonymous(client: AsyncClient):
    """Anonymous users should only see public posts."""
    resp = await client.get("/api/v1/social/posts")
    assert resp.status_code == 200
    feed = resp.json()
    # All returned posts should be public
    for p in feed["posts"]:
        assert p["visibility"] == "public"


@pytest.mark.asyncio
async def test_board_tags(client: AsyncClient):
    """Board tags endpoint should return a list."""
    resp = await client.get("/api/v1/board/tags")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_board_posts(client: AsyncClient):
    """Board posts should return paginated response."""
    resp = await client.get("/api/v1/board/posts")
    assert resp.status_code == 200
    data = resp.json()
    assert "posts" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_board_create_post(client: AsyncClient, registered_user: dict):
    """Create a board post (need valid tag, may fail if no tags seeded — that's OK)."""
    headers = auth_headers(registered_user["access_token"])
    # First get tags
    tags_resp = await client.get("/api/v1/board/tags")
    tags = tags_resp.json()

    if tags:
        resp = await client.post("/api/v1/board/posts",
            json={
                "content": "Tìm trọ gần trường",
                "board_tag_id": tags[0]["id"],
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["post_type"] == "board"
    else:
        pytest.skip("No board tags seeded")
