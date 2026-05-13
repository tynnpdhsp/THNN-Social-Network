"""Tests for board tags / posts and image upload."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.social.schemas import BoardPostCreateRequest
from tests.unit.modules.social.conftest import make_fake_post


@pytest.mark.asyncio
class TestBoard:
    async def test_get_board_tags(self, social_service, mock_social_repo):
        t = MagicMock()
        t.id = "t1"
        t.name = "Học tập"
        t.slug = "hoc-tap"
        mock_social_repo.get_board_tags = AsyncMock(return_value=[t])

        tags = await social_service.get_board_tags()
        assert len(tags) == 1
        assert tags[0].slug == "hoc-tap"

    async def test_get_board_posts(self, social_service, mock_social_repo, patch_get_redis):
        p = make_fake_post(postType="board")
        mock_social_repo.get_board_posts = AsyncMock(return_value=[p])
        mock_social_repo.count_board_posts = AsyncMock(return_value=1)
        mock_social_repo.get_like = AsyncMock(return_value=None)

        res = await social_service.get_board_posts(skip=0, limit=5, tag_id="t1")
        assert res.total == 1
        mock_social_repo.get_board_posts.assert_awaited_once()

    async def test_create_board_post(self, social_service, mock_social_repo, patch_get_redis):
        p = make_fake_post(postType="board")
        mock_social_repo.create_post = AsyncMock(return_value=p)
        mock_social_repo.get_post_by_id = AsyncMock(return_value=p)
        mock_social_repo.get_like = AsyncMock(return_value=None)

        body = BoardPostCreateRequest(content="Board", board_tag_id="tag-1")
        out = await social_service.create_board_post("u1", body)
        assert out.post_type == "board"
        call = mock_social_repo.create_post.await_args.kwargs["data"]
        assert call["postType"] == "board"
        assert call["boardTagId"] == "tag-1"


@pytest.mark.asyncio
class TestUploadPostImage:
    async def test_delegates_to_storage(self, social_service):
        with patch("app.utils.storage.upload_file", new=AsyncMock(return_value="/thnn/posts/u1/x.jpg")) as up:
            url = await social_service.upload_post_image("u1", b"bytes", "a.png")
            assert up.await_args[0][2].startswith("posts/u1")
            assert "posts" in url
