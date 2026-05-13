"""Pydantic schema tests for ``app/modules/social/schemas.py``."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.modules.social.schemas import (
    PostCreateRequest,
    PostUpdateRequest,
    PostImageCreate,
    CommentRequest,
    BoardPostCreateRequest,
)


class TestPostCreateRequest:
    def test_defaults(self):
        p = PostCreateRequest(content="Hi")
        assert p.visibility == "public"
        assert p.post_type == "feed"
        assert p.images == []

    def test_with_images(self):
        p = PostCreateRequest(
            content="X",
            visibility="friends",
            post_type="feed",
            images=[PostImageCreate(image_url="https://a/b.jpg", display_order=1)],
        )
        assert len(p.images) == 1


class TestCommentRequest:
    def test_top_level(self):
        c = CommentRequest(content="Hello")
        assert c.parent_comment_id is None

    def test_reply(self):
        c = CommentRequest(content="Reply", parent_comment_id="parent-1")
        assert c.parent_comment_id == "parent-1"

    def test_content_too_long(self):
        with pytest.raises(ValidationError):
            CommentRequest(content="x" * 2001)


class TestPostUpdateRequest:
    def test_empty_ok(self):
        PostUpdateRequest()

    def test_partial(self):
        u = PostUpdateRequest(content="new", is_hidden=True)
        assert u.is_hidden is True


class TestBoardPostCreateRequest:
    def test_requires_tag(self):
        BoardPostCreateRequest(content="B", board_tag_id="tag-1")

    def test_missing_tag_raises(self):
        with pytest.raises(ValidationError):
            BoardPostCreateRequest(content="B")  # type: ignore
