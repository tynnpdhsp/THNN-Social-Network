"""Pydantic constraints for shop schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.modules.shop.schemas import (
    CartItemCreate,
    ItemCreate,
    ItemUpdate,
    OrderCreate,
    ReviewCreate,
)


class TestItemCreate:
    def test_price_must_be_positive(self):
        with pytest.raises(ValidationError):
            ItemCreate(
                category_id="c",
                title="t",
                description="desc here",
                price=0,
                image_urls=[],
            )

    def test_valid(self):
        m = ItemCreate(
            category_id="c",
            title="t",
            description="desc here",
            price=0.01,
            image_urls=["https://x/a.png"],
        )
        assert m.price == 0.01


class TestItemUpdate:
    def test_status_pattern(self):
        with pytest.raises(ValidationError):
            ItemUpdate(status="invalid")

        u = ItemUpdate(status="active")
        assert u.status == "active"


class TestReviewCreate:
    def test_rating_bounds(self):
        with pytest.raises(ValidationError):
            ReviewCreate(rating=0)
        with pytest.raises(ValidationError):
            ReviewCreate(rating=6)

        r = ReviewCreate(rating=3, comment=None)
        assert r.rating == 3


class TestCartItemCreate:
    def test_quantity_bounds(self):
        with pytest.raises(ValidationError):
            CartItemCreate(item_id="i", quantity=0)
        with pytest.raises(ValidationError):
            CartItemCreate(item_id="i", quantity=11)


class TestOrderCreate:
    def test_payment_method_pattern(self):
        with pytest.raises(ValidationError):
            OrderCreate(item_id="i", payment_method="cash", amount=1)

        o = OrderCreate(item_id="i", payment_method="vnpay", amount=5)
        assert o.amount == 5
