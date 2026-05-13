"""Tests for ``SocialService._map_post_to_response`` and ``_map_comment_to_response``."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from tests.unit.conftest import make_fake_user
from tests.unit.modules.social.conftest import make_fake_comment, make_fake_post, make_fake_post_image


@pytest.mark.asyncio
class TestMapPostToResponse:
    async def test_counters_from_redis_override_post_fields(
        self, social_service, mock_social_repo, patch_get_redis
    ):
        from app.core.cache import set_post_counters

        post = make_fake_post(likeCount=1, commentCount=1)
        post.postImages = [make_fake_post_image()]
        post.user = make_fake_user(id="author-1", fullName="Author")

        await set_post_counters(post.id, 10, 20)
        mock_social_repo.get_like = AsyncMock(return_value=None)

        out = await social_service._map_post_to_response(post, viewer_id=None)
        assert out.like_count == 10
        assert out.comment_count == 20
        assert len(out.images) == 1
        assert out.user_info is not None
        assert out.user_info.full_name == "Author"

    async def test_is_liked_when_viewer_has_like(
        self, social_service, mock_social_repo, patch_get_redis
    ):
        post = make_fake_post()
        mock_social_repo.get_like = AsyncMock(return_value=MagicMock())

        out = await social_service._map_post_to_response(post, viewer_id="v1")
        assert out.is_liked is True

    async def test_board_tag_name(self, social_service, mock_social_repo, patch_get_redis):
        post = make_fake_post()
        tag = MagicMock()
        tag.name = "Study"
        post.boardTag = tag
        mock_social_repo.get_like = AsyncMock(return_value=None)

        out = await social_service._map_post_to_response(post, viewer_id=None)
        assert out.board_tag_name == "Study"


@pytest.mark.asyncio
class TestMapPostCountersSeedRedis:
    async def test_sets_counters_when_redis_miss(
        self, social_service, mock_social_repo, patch_get_redis
    ):
        post = make_fake_post(likeCount=5, commentCount=7)
        mock_social_repo.get_like = AsyncMock(return_value=None)

        await social_service._map_post_to_response(post, viewer_id=None)
        from app.core.cache import get_post_counters

        cached = await get_post_counters(post.id)
        assert cached == {"like_count": 5, "comment_count": 7}


class TestMapCommentToResponse:
    def test_replies_from_json_string(self, social_service):
        raw = [{"user_info": {"id": "u2", "full_name": "B", "avatar_url": None}, "content": "r", "is_hidden": False}]
        c = make_fake_comment(replies=json.dumps(raw))
        out = social_service._map_comment_to_response(c)
        assert out.content == "Nice"
        assert len(out.replies) == 1

    def test_replies_empty_list(self, social_service):
        c = make_fake_comment(replies=[])
        out = social_service._map_comment_to_response(c)
        assert out.replies == []
