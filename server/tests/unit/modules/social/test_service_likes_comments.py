"""Tests for likes and comments on ``SocialService``."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import NotFoundException
from app.modules.social.schemas import CommentRequest
from tests.unit.conftest import make_fake_user
from tests.unit.modules.social.conftest import make_fake_comment, make_fake_post


@pytest.mark.asyncio
class TestToggleLike:
    async def test_post_not_found(self, social_service, mock_social_repo):
        mock_social_repo.get_post_by_id = AsyncMock(return_value=None)
        with pytest.raises(NotFoundException):
            await social_service.toggle_like("u1", "missing")

    async def test_unlike_when_exists(self, social_service, mock_social_repo):
        post = make_fake_post()
        mock_social_repo.get_post_by_id = AsyncMock(return_value=post)
        like = MagicMock()
        like.id = "like-1"
        mock_social_repo.get_like = AsyncMock(return_value=like)

        out = await social_service.toggle_like("u1", post.id)
        assert out["liked"] is False
        mock_social_repo.delete_like.assert_awaited()

    async def test_like_creates_and_notifies_when_allowed(
        self, social_service, mock_social_repo, mock_notification_repo, patch_get_redis, patch_social_deps, mock_db
    ):
        post = make_fake_post(userId="author")
        mock_social_repo.get_post_by_id = AsyncMock(return_value=post)
        mock_social_repo.get_like = AsyncMock(return_value=None)
        mock_db.notificationsetting.find_unique = AsyncMock(return_value=None)
        mock_db.user.find_unique = AsyncMock(return_value=make_fake_user(id="liker", fullName="Liker"))

        out = await social_service.toggle_like("liker", post.id)
        assert out["liked"] is True
        mock_social_repo.create_like.assert_awaited()
        mock_notification_repo.create.assert_awaited()

    async def test_no_self_notification(
        self, social_service, mock_social_repo, mock_notification_repo, patch_get_redis, patch_social_deps, mock_db
    ):
        post = make_fake_post(userId="me")
        mock_social_repo.get_post_by_id = AsyncMock(return_value=post)
        mock_social_repo.get_like = AsyncMock(return_value=None)
        mock_db.notificationsetting.find_unique = AsyncMock(return_value=None)
        mock_db.user.find_unique = AsyncMock(return_value=make_fake_user(id="me", fullName="Me"))

        mock_notification_repo.create.reset_mock()
        await social_service.toggle_like("me", post.id)
        mock_notification_repo.create.assert_not_called()

    async def test_respects_notify_like_off(
        self, social_service, mock_social_repo, mock_notification_repo, patch_get_redis, patch_social_deps, mock_db
    ):
        post = make_fake_post(userId="author")
        mock_social_repo.get_post_by_id = AsyncMock(return_value=post)
        mock_social_repo.get_like = AsyncMock(return_value=None)
        ns = MagicMock()
        ns.notifyLike = False
        mock_db.notificationsetting.find_unique = AsyncMock(return_value=ns)
        mock_db.user.find_unique = AsyncMock(return_value=make_fake_user(id="liker", fullName="L"))

        mock_notification_repo.create.reset_mock()
        await social_service.toggle_like("liker", post.id)
        mock_notification_repo.create.assert_not_called()


@pytest.mark.asyncio
class TestAddComment:
    async def test_user_not_found(self, social_service, mock_social_repo, patch_social_deps, mock_db):
        mock_social_repo.get_post_by_id = AsyncMock(return_value=make_fake_post())
        mock_db.user.find_unique = AsyncMock(return_value=None)
        with pytest.raises(NotFoundException) as e:
            await social_service.add_comment("ghost", "post-1", CommentRequest(content="x"))
        assert e.value.error_code == "USER_NOT_FOUND"

    async def test_top_level_notifies_author(
        self, social_service, mock_social_repo, mock_notification_repo, patch_social_deps, mock_db, patch_get_redis
    ):
        post = make_fake_post(userId="author")
        mock_social_repo.get_post_by_id = AsyncMock(return_value=post)
        mock_db.user.find_unique = AsyncMock(return_value=make_fake_user(id="c1", fullName="Commenter"))
        new_c = make_fake_comment(id="nc1")
        mock_social_repo.create_comment = AsyncMock(return_value=new_c)
        mock_db.notificationsetting.find_unique = AsyncMock(return_value=None)

        await social_service.add_comment("c1", post.id, CommentRequest(content="Hi"))
        mock_notification_repo.create.assert_awaited()

    async def test_reply_parent_missing(
        self, social_service, mock_social_repo, patch_social_deps, mock_db
    ):
        mock_db.user.find_unique = AsyncMock(return_value=make_fake_user(id="c1"))
        mock_social_repo.add_reply_to_comment = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as e:
            await social_service.add_comment(
                "c1", "post-1", CommentRequest(content="r", parent_comment_id="missing")
            )
        assert e.value.error_code == "COMMENT_NOT_FOUND"


@pytest.mark.asyncio
class TestGetComments:
    async def test_maps_all(self, social_service, mock_social_repo):
        c1 = make_fake_comment(id="1")
        c2 = make_fake_comment(id="2", content="B")
        mock_social_repo.get_comments_by_target = AsyncMock(return_value=[c1, c2])

        out = await social_service.get_comments("post-1")
        assert len(out) == 2
        assert out[0].id == "1"
