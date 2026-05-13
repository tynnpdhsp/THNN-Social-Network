"""Place module unit test helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture(autouse=True)
def fresh_place_repo_methods(mock_place_repo):
    for name in (
        "get_category_by_name",
        "create_place_category",
        "get_all_category",
        "get_category_by_id",
        "delete_place_category",
        "create_place",
        "get_place_by_id",
        "update_place",
        "delete_place",
        "get_place_images",
        "create_place_images",
        "delete_place_image",
        "get_place_image_by_id",
        "get_user_review",
        "get_review_by_id",
        "get_place_reviews",
        "count_reviews",
        "create_review_with_transaction",
        "delete_review_with_transaction",
        "get_user_bookmark",
        "create_bookmark",
        "delete_bookmark",
        "get_user_bookmarks",
        "count_user_bookmarks",
        "get_nearby_places",
    ):
        setattr(mock_place_repo, name, AsyncMock())
    yield


def make_category_row(cid="pc-1", name="Food", icon="🍔"):
    c = MagicMock()
    c.id = cid
    c.name = name
    c.icon = icon
    return c


def make_user_row(uid="u-1", full_name="Test User", avatar_url=None):
    u = MagicMock()
    u.id = uid
    u.fullName = full_name
    u.avatarUrl = avatar_url
    return u


def make_place_row(**kwargs):
    p = MagicMock()
    defaults = dict(
        id="pl-1",
        userId="owner-1",
        categoryId="pc-1",
        name="Cafe",
        description="Nice",
        latitude=10.5,
        longitude=106.6,
        address="HCMC",
        avgRating=4.0,
        ratingCount=1,
        createdAt=datetime(2025, 6, 1, tzinfo=timezone.utc),
        updatedAt=datetime(2025, 6, 2, tzinfo=timezone.utc),
        user=None,
        category=None,
        placeImages=[],
    )
    for k, v in {**defaults, **kwargs}.items():
        setattr(p, k, v)
    return p


def make_place_image_row(iid="img-1", pid="pl-1", url="https://x/a.jpg", order=0):
    im = MagicMock()
    im.id = iid
    im.placeId = pid
    im.imageUrl = url
    im.displayOrder = order
    im.createdAt = datetime(2025, 6, 3, tzinfo=timezone.utc)
    return im


def make_review_row(rid="rv-1", target_id="pl-1", uid="u-1"):
    r = MagicMock()
    r.id = rid
    r.targetId = target_id
    r.targetType = "place"
    r.userInfo = {"id": uid, "full_name": "Me", "avatar_url": None}
    r.rating = 5
    r.comment = "ok"
    r.createdAt = datetime(2025, 6, 4, tzinfo=timezone.utc)
    return r


def make_bookmark_row(bid="bm-1", uid="u-1", pid="pl-1", place=None):
    b = MagicMock()
    b.id = bid
    b.userId = uid
    b.placeId = pid
    b.createdAt = datetime(2025, 6, 5, tzinfo=timezone.utc)
    pl = place or make_place_row(id=pid)
    if pl.user is None:
        pl.user = make_user_row(uid=pl.userId or uid)
    if pl.category is None:
        pl.category = make_category_row(cid=getattr(pl, "categoryId", None) or "pc-1")
    b.place = pl
    return b


def make_upload_file_mock(content=b"bytes", name="f.jpg"):
    f = MagicMock()
    f.filename = name
    f.read = AsyncMock(return_value=content)
    return f
