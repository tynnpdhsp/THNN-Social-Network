"""Orders: create, get by id, buyer/seller lists."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException
from app.modules.shop.schemas import OrderCreate

from .conftest import make_order_row, make_shop_item


@pytest.mark.asyncio
class TestCreateOrder:
    async def test_item_not_found(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await shop_service.create_order(
                OrderCreate(item_id="missing", payment_method="vnpay", amount=1),
                "buyer-1",
            )

        assert exc.value.error_code == "ITEM_NOT_FOUND"

    async def test_success_maps_response(self, shop_service, mock_shop_repo):
        item = make_shop_item(sellerId="sell-9")
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=item)
        order = make_order_row()
        mock_shop_repo.create_order = AsyncMock(return_value=order)

        out = await shop_service.create_order(
            OrderCreate(item_id="item-1", payment_method="vnpay", amount=2),
            "buyer-1",
        )

        mock_shop_repo.create_order.assert_awaited_once()
        data_arg, buyer, seller = mock_shop_repo.create_order.await_args[0]
        assert data_arg.item_id == "item-1"
        assert buyer == "buyer-1"
        assert seller == "sell-9"
        assert out.id == "ord-1"

    async def test_repo_exception_propagates(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=make_shop_item())
        mock_shop_repo.create_order = AsyncMock(side_effect=RuntimeError("db"))

        with pytest.raises(RuntimeError, match="db"):
            await shop_service.create_order(
                OrderCreate(item_id="item-1", payment_method="vnpay", amount=1),
                "buyer-1",
            )


@pytest.mark.asyncio
class TestGetOrderById:
    async def test_not_found(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_order_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await shop_service.get_order_by_id("o1", "u1")

    async def test_forbidden_neither_buyer_nor_seller(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_order_by_id = AsyncMock(
            return_value=make_order_row(buyerId="b", sellerId="s")
        )

        with pytest.raises(ForbiddenException) as exc:
            await shop_service.get_order_by_id("o1", "stranger")

        assert exc.value.error_code == "ORDER_ACCESS_DENIED"

    async def test_buyer_allowed(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_order_by_id = AsyncMock(
            return_value=make_order_row(buyerId="buyer-1", sellerId="s")
        )

        out = await shop_service.get_order_by_id("o1", "buyer-1")

        assert out.buyer_id == "buyer-1"

    async def test_seller_allowed(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_order_by_id = AsyncMock(
            return_value=make_order_row(buyerId="b", sellerId="sell-x")
        )

        out = await shop_service.get_order_by_id("o1", "sell-x")

        assert out.seller_id == "sell-x"


@pytest.mark.asyncio
class TestOrderLists:
    async def test_buyer_list(self, shop_service, mock_shop_repo):
        o = make_order_row()
        mock_shop_repo.get_orders_by_buyer = AsyncMock(return_value=[o])
        mock_shop_repo.count_orders_by_buyer = AsyncMock(return_value=3)

        out = await shop_service.get_orders_by_buyer("b1", skip=0, limit=5)

        assert out.total == 3
        assert len(out.orders) == 1

    async def test_seller_list(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_orders_by_seller = AsyncMock(return_value=[])
        mock_shop_repo.count_orders_by_seller = AsyncMock(return_value=0)

        out = await shop_service.get_orders_by_seller("s1")

        mock_shop_repo.get_orders_by_seller.assert_awaited_once_with("s1", 0, 20)
        assert out.total == 0
