"""Cart operations."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import NotFoundException
from app.modules.shop.schemas import CartItemCreate

from .conftest import make_cart_row, make_shop_item


@pytest.mark.asyncio
class TestGetCart:
    async def test_total_amount_sum(self, shop_service, mock_shop_repo):
        i1 = make_shop_item(id="a", price=10.0)
        i2 = make_shop_item(id="b", price=5.5)
        mock_shop_repo.get_cart_items = AsyncMock(
            return_value=[make_cart_row(i1, 2), make_cart_row(i2, 1)]
        )

        out = await shop_service.get_cart("user-1")

        assert len(out.items) == 2
        assert out.total_amount == 25.5
        assert out.items[0].quantity == 2


@pytest.mark.asyncio
class TestAddToCart:
    async def test_item_not_found(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await shop_service.add_to_cart("u1", CartItemCreate(item_id="x", quantity=1))

    async def test_adds(self, shop_service, mock_shop_repo):
        item = make_shop_item()
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=item)
        row = make_cart_row(item, qty=3)
        mock_shop_repo.add_to_cart = AsyncMock(return_value=row)

        out = await shop_service.add_to_cart("u1", CartItemCreate(item_id="item-1", quantity=3))

        assert out.quantity == 3
        mock_shop_repo.add_to_cart.assert_awaited_once_with("u1", "item-1", 3)


@pytest.mark.asyncio
class TestUpdateCartItem:
    async def test_not_found_wraps(self, shop_service, mock_shop_repo):
        mock_shop_repo.update_cart_item = AsyncMock(side_effect=Exception("no row"))

        with pytest.raises(NotFoundException) as exc:
            await shop_service.update_cart_item("u1", "item-1", 5)

        assert exc.value.error_code == "CART_ITEM_NOT_FOUND"


@pytest.mark.asyncio
class TestRemoveFromCart:
    async def test_not_found(self, shop_service, mock_shop_repo):
        mock_shop_repo.remove_from_cart = AsyncMock(side_effect=Exception())

        with pytest.raises(NotFoundException) as exc:
            await shop_service.remove_from_cart("u1", "item-1")

        assert exc.value.error_code == "CART_ITEM_NOT_FOUND"

    async def test_success(self, shop_service, mock_shop_repo):
        mock_shop_repo.remove_from_cart = AsyncMock()

        out = await shop_service.remove_from_cart("u1", "item-1")

        assert "removed" in out.message.lower()


@pytest.mark.asyncio
class TestClearCart:
    async def test_clears(self, shop_service, mock_shop_repo):
        mock_shop_repo.clear_cart = AsyncMock()

        out = await shop_service.clear_cart("u1")

        mock_shop_repo.clear_cart.assert_awaited_once_with("u1")
        assert "cleared" in out.message.lower()
