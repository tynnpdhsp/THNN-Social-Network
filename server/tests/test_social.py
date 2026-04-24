import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_social_flow(client: AsyncClient, registered_user: dict):
    # 1. Create Post
    resp = await client.post("/api/v1/social/posts", 
        json={
            "content": "Test post content",
            "visibility": "public"
        },
        headers={"Authorization": f"Bearer {registered_user['access_token']}"}
    )
    assert resp.status_code == 200
    post = resp.json()
    post_id = post["id"]
    assert post["content"] == "Test post content"

    # 2. Get Feed
    resp = await client.get("/api/v1/social/posts")
    assert resp.status_code == 200
    feed = resp.json()
    assert any(p["id"] == post_id for p in feed)

    # 3. Toggle Like
    resp = await client.post(f"/api/v1/social/posts/{post_id}/like",
        headers={"Authorization": f"Bearer {registered_user['access_token']}"}
    )
    assert resp.status_code == 200
    assert resp.json()["liked"] is True

    # 4. Add Comment
    resp = await client.post(f"/api/v1/social/posts/{post_id}/comments",
        json={"content": "Top level comment"},
        headers={"Authorization": f"Bearer {registered_user['access_token']}"}
    )
    assert resp.status_code == 200
    comment = resp.json()
    comment_id = comment["id"]

    # 5. Add Reply (Level 2)
    resp = await client.post(f"/api/v1/social/posts/{post_id}/comments",
        json={
            "content": "Nested reply",
            "parent_comment_id": comment_id
        },
        headers={"Authorization": f"Bearer {registered_user['access_token']}"}
    )
    assert resp.status_code == 200
    updated_comment = resp.json()
    assert len(updated_comment["replies"]) == 1
    assert updated_comment["replies"][0]["content"] == "Nested reply"

    # 6. Delete Post
    resp = await client.delete(f"/api/v1/social/posts/{post_id}",
        headers={"Authorization": f"Bearer {registered_user['access_token']}"}
    )
    assert resp.status_code == 200
