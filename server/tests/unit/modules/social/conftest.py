"""
Fixtures for social unit tests: patch Prisma ``db`` / ``get_account_repo`` used inside
``SocialService`` (runtime imports from ``app.core.dependencies``).
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.account.repository import AccountRepository


@pytest.fixture()
def patch_social_deps(mock_social_repo):
    """Route ``SocialService`` inline ``AccountRepository`` / ``db`` calls to the same mock DB."""
    db = mock_social_repo.db
    with patch("app.core.dependencies.db", db), patch(
        "app.core.dependencies.get_account_repo",
        lambda prisma_db=None: AccountRepository(db),
    ):
        yield db


def make_fake_post(**overrides) -> MagicMock:
    m = MagicMock()
    defaults = dict(
        id="post-1",
        userId="author-1",
        content="Hello world",
        visibility="public",
        postType="feed",
        boardTagId=None,
        deletedAt=None,
        createdAt=datetime(2025, 3, 1, tzinfo=timezone.utc),
        updatedAt=datetime(2025, 3, 1, tzinfo=timezone.utc),
        likeCount=2,
        commentCount=3,
        isHidden=False,
        postImages=[],
        user=None,
        boardTag=None,
    )
    for k, v in {**defaults, **overrides}.items():
        setattr(m, k, v)
    return m


def make_fake_post_image(img_id="img-1", url="https://x/a.jpg", order=0, media_type="image"):
    im = MagicMock()
    im.id = img_id
    im.imageUrl = url
    im.displayOrder = order
    im.mediaType = media_type
    return im


def make_fake_comment(**overrides) -> MagicMock:
    c = MagicMock()
    defaults = dict(
        id="com-1",
        targetId="post-1",
        targetType="post",
        userInfo={"id": "u1", "full_name": "Commenter", "avatar_url": None},
        content="Nice",
        replies=[],
        isHidden=False,
        createdAt=datetime(2025, 3, 2, tzinfo=timezone.utc),
    )
    for k, v in {**defaults, **overrides}.items():
        setattr(c, k, v)
    return c


def make_privacy_mock(who_friend_req="everyone", who_see="everyone"):
    p = MagicMock()
    p.whoCanFriendReq = who_friend_req
    p.whoCanSeePosts = who_see
    p.userId = "target-user"
    return p


def make_fake_notification_row(**kwargs) -> MagicMock:
    """Minimal shape for ``NotificationService._map_to_response``."""
    m = MagicMock()
    defaults = dict(
        id="notif-1",
        userId="user-target",
        type="like",
        title="Title",
        content="Body",
        metadata={"reference_id": "ref-1", "reference_type": "post"},
        isRead=False,
        createdAt=datetime.now(timezone.utc),
    )
    defaults.update(kwargs)
    for k, v in defaults.items():
        setattr(m, k, v)
    return m


@pytest.fixture(autouse=True)
def mock_notification_create_row(mock_notification_repo):
    """``NotificationService.create_notification`` maps the DB row — return a valid shape."""
    mock_notification_repo.create = AsyncMock(return_value=make_fake_notification_row())
    yield
