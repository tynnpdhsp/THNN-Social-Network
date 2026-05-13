"""Shop unit test helpers and repo method reset."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def fresh_shop_repo_methods(mock_shop_repo):
    for name in (
        "get_category_by_name",
        "get_category_by_id",
        "create_category",
        "update_category",
        "delete_category",
        "get_all_categories",
        "get_item_by_id",
        "get_items",
        "count_items",
        "get_my_items",
        "create_item",
        "update_item",
        "delete_item",
        "create_order",
        "get_order_by_id",
        "get_orders_by_buyer",
        "count_orders_by_buyer",
        "get_orders_by_seller",
        "count_orders_by_seller",
        "update_order",
        "get_order_by_vnpay_ref",
        "create_review_with_transaction",
        "get_item_reviews",
        "count_reviews",
        "get_review_by_id",
        "delete_review_with_transaction",
        "get_cart_items",
        "add_to_cart",
        "update_cart_item",
        "remove_from_cart",
        "clear_cart",
    ):
        setattr(mock_shop_repo, name, AsyncMock())
    yield


@pytest.fixture()
def shop_vnpay_settings():
    """Stable VNPay + MinIO settings for ``app.modules.shop.service``."""
    s = SimpleNamespace(
        VNPAY_TMN_CODE="TEST_TMN",
        VNPAY_HASH_SECRET="unit_test_secret",
        VNPAY_RETURN_URL="https://example.com/vnpay/return",
        VNPAY_URL="https://sandbox.vnpay.test/pay",
        MINIO_ENDPOINT="localhost:9000",
        MINIO_SECURE=False,
    )
    with patch("app.modules.shop.service.settings", s):
        yield s


def make_category_row(cid="cat-1", name="Books", desc="d"):
    c = MagicMock()
    c.id = cid
    c.name = name
    c.description = desc
    return c


def make_shop_item(**kwargs):
    m = MagicMock()
    defaults = dict(
        id="item-1",
        sellerId="seller-1",
        categoryId="cat-1",
        title="Widget",
        description="Nice widget",
        price=100.0,
        avgRating=4.2,
        ratingCount=3,
        status="active",
        createdAt=datetime(2025, 4, 1, tzinfo=timezone.utc),
        updatedAt=datetime(2025, 4, 2, tzinfo=timezone.utc),
        seller=None,
        category=None,
        itemImages=[],
    )
    for k, v in {**defaults, **kwargs}.items():
        setattr(m, k, v)
    return m


def make_order_row(**kwargs):
    o = MagicMock()
    defaults = dict(
        id="ord-1",
        buyerId="buyer-1",
        sellerId="seller-1",
        itemId="item-1",
        amount=250.0,
        status="pending",
        paymentMethod="vnpay",
        vnpayTxnRef="TXNREF123456",
        vnpayResponseCode=None,
        paidAt=None,
        createdAt=datetime(2025, 4, 3, tzinfo=timezone.utc),
        updatedAt=datetime(2025, 4, 3, tzinfo=timezone.utc),
        seller=None,
    )
    for k, v in {**defaults, **kwargs}.items():
        setattr(o, k, v)
    return o


def make_review_row(rid="rev-1", target_id="item-1", user_id_in_info="u-1"):
    r = MagicMock()
    r.id = rid
    r.targetId = target_id
    r.targetType = "item"
    r.userInfo = {"id": user_id_in_info, "full_name": "Reviewer", "avatar_url": None}
    r.rating = 5
    r.comment = "Great"
    r.createdAt = datetime(2025, 4, 5, tzinfo=timezone.utc)
    return r


def make_cart_row(item_mock, qty=2):
    row = MagicMock()
    row.itemId = item_mock.id
    row.quantity = qty
    row.item = item_mock
    return row
