"""Tests for post-related ``SocialService`` methods."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException
from app.modules.social.schemas import PostCreateRequest, PostImageCreate, PostUpdateRequest
from tests.unit.modules.social.conftest import make_fake_post
@pytest.mark.asyncio
class TestCreatePost:
    async def test_creates_feed_pushes_newsfeed_and_counters(
        self, social_service, mock_social_repo, patch_get_redis
    ):
        created = make_fake_post(id="new-post", userId="u1")
        mock_social_repo.create_post = AsyncMock(return_value=created)
        mock_social_repo.get_post_by_id = AsyncMock(return_value=created)
        mock_social_repo.get_like = AsyncMock(return_value=None)

        body = PostCreateRequest(content="Hello", visibility="public", post_type="feed")
        out = await social_service.create_post("u1", body)

        mock_social_repo.create_post.assert_awaited_once()
        assert out.id == "new-post"
        from app.core.cache import get_post_counters

        assert await get_post_counters("new-post") is not None

    async def test_with_images_refetches_post(
        self, social_service, mock_social_repo, patch_get_redis
    ):
        p1 = make_fake_post(id="p-img")
        p2 = make_fake_post(id="p-img", postImages=[MagicMock(id="i1", imageUrl="/x.jpg", displayOrder=0)])
        mock_social_repo.create_post = AsyncMock(return_value=p1)
        mock_social_repo.get_post_by_id = AsyncMock(side_effect=[p2])
        mock_social_repo.create_post_images = AsyncMock()
        mock_social_repo.get_like = AsyncMock(return_value=None)

        body = PostCreateRequest(
            content="Pic",
            images=[PostImageCreate(image_url="/a.jpg", display_order=0)],
        )
        await social_service.create_post("u1", body)
        mock_social_repo.create_post_images.assert_awaited_once()


@pytest.mark.asyncio
class TestGetPostsFeed:
    async def test_anonymous_no_user_id_skips_privacy_block_queries(
        self, social_service, mock_social_repo, patch_get_redis
    ):
        mock_social_repo.get_posts_feed = AsyncMock(return_value=[])
        mock_social_repo.count_posts_feed = AsyncMock(return_value=0)
        mock_social_repo.get_like = AsyncMock(return_value=None)

        res = await social_service.get_posts_feed(None, skip=0, limit=10)
        assert res.total == 0
        mock_social_repo.get_friend_ids.assert_not_called()

    async def test_logged_in_merges_privacy_hidden_users(
        self, social_service, mock_social_repo, patch_get_redis, mock_db
    ):
        mock_social_repo.get_friend_ids = AsyncMock(return_value=["f1"])
        mock_db.userblock.find_many = AsyncMock(return_value=[])
        ps = MagicMock()
        ps.userId = "hidden-user"
        ps.whoCanSeePosts = "only_me"
        mock_db.privacysetting.find_many = AsyncMock(return_value=[ps])

        captured = {}

        async def capture_feed(*args, **kwargs):
            captured.update(kwargs)
            return []

        mock_social_repo.get_posts_feed = AsyncMock(side_effect=capture_feed)
        mock_social_repo.count_posts_feed = AsyncMock(return_value=0)
        mock_social_repo.get_like = AsyncMock(return_value=None)

        await social_service.get_posts_feed("viewer-1", skip=0, limit=5)
        blocked = captured.get("blocked_ids") or []
        assert "hidden-user" in blocked


@pytest.mark.asyncio
class TestGetUserPosts:
    async def test_owner_sees_all_visibilities(self, social_service, mock_social_repo, mock_db, patch_get_redis):
        mock_db.post.find_many = AsyncMock(return_value=[])
        mock_db.post.count = AsyncMock(return_value=0)
        mock_social_repo.get_like = AsyncMock(return_value=None)

        await social_service.get_user_posts("same", "same", skip=0, limit=5)
        call_kw = mock_db.post.find_many.await_args.kwargs["where"]
        assert set(call_kw["visibility"]["in"]) == {"public", "friends", "private"}

    async def test_stranger_public_only(self, social_service, mock_social_repo, mock_db, patch_get_redis):
        mock_db.post.find_many = AsyncMock(return_value=[])
        mock_db.post.count = AsyncMock(return_value=0)
        mock_social_repo.get_like = AsyncMock(return_value=None)

        await social_service.get_user_posts("author", None, skip=0, limit=5)
        where = mock_db.post.find_many.await_args.kwargs["where"]
        assert where["visibility"]["in"] == ["public"]

    async def test_friend_sees_friends_posts(self, social_service, mock_social_repo, mock_db, patch_get_redis):
        mock_social_repo.get_friend_ids = AsyncMock(return_value=["viewer-1"])
        mock_db.post.find_many = AsyncMock(return_value=[])
        mock_db.post.count = AsyncMock(return_value=0)
        mock_social_repo.get_like = AsyncMock(return_value=None)

        await social_service.get_user_posts("author", "viewer-1")
        where = mock_db.post.find_many.await_args.kwargs["where"]
        assert set(where["visibility"]["in"]) == {"public", "friends"}


@pytest.mark.asyncio
class TestGetPostDetails:
    async def test_deleted_raises(self, social_service, mock_social_repo):
        p = make_fake_post(deletedAt=MagicMock())
        mock_social_repo.get_post_by_id = AsyncMock(return_value=p)
        with pytest.raises(NotFoundException) as e:
            await social_service.get_post_details("post-1")
        assert e.value.error_code == "POST_NOT_FOUND"

    async def test_missing_raises(self, social_service, mock_social_repo):
        mock_social_repo.get_post_by_id = AsyncMock(return_value=None)
        with pytest.raises(NotFoundException):
            await social_service.get_post_details("missing")


@pytest.mark.asyncio
class TestUpdateDeletePost:
    async def test_update_forbidden_not_owner(self, social_service, mock_social_repo):
        p = make_fake_post(userId="owner")
        mock_social_repo.get_post_by_id = AsyncMock(return_value=p)
        with pytest.raises(ForbiddenException):
            await social_service.update_post(
                "other", "post-1", PostUpdateRequest(content="hack")
            )

    async def test_update_success(self, social_service, mock_social_repo, patch_get_redis):
        p = make_fake_post(userId="me")
        updated = make_fake_post(userId="me", content="new")
        mock_social_repo.get_post_by_id = AsyncMock(return_value=p)
        mock_social_repo.update_post = AsyncMock(return_value=updated)
        mock_social_repo.get_like = AsyncMock(return_value=None)

        out = await social_service.update_post(
            "me", "post-1", PostUpdateRequest(content="new", is_hidden=True)
        )
        assert out.content == "new"
        mock_social_repo.update_post.assert_awaited()
        call_data = mock_social_repo.update_post.await_args[0][1]
        assert call_data.get("isHidden") is True

    async def test_delete_forbidden(self, social_service, mock_social_repo):
        p = make_fake_post(userId="owner")
        mock_social_repo.get_post_by_id = AsyncMock(return_value=p)
        with pytest.raises(ForbiddenException):
            await social_service.delete_post("intruder", "post-1")

    async def test_delete_success(self, social_service, mock_social_repo):
        p = make_fake_post(userId="me")
        mock_social_repo.get_post_by_id = AsyncMock(return_value=p)
        msg = await social_service.delete_post("me", "post-1")
        mock_social_repo.soft_delete_post.assert_awaited_with("post-1")
        assert "xóa" in msg.lower()
