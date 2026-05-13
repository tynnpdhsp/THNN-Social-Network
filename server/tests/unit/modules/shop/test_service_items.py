"""Items, ``upload_item_images``, ``get_hot_items``."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.modules.shop.schemas import ItemCreate, ItemListQuery, ItemPaginationRequest, ItemUpdate

from .conftest import make_shop_item


@pytest.mark.asyncio
class TestGetItems:
    async def test_pagination_delegates_to_repo(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_items = AsyncMock(return_value=[])
        mock_shop_repo.count_items = AsyncMock(return_value=0)

        q = ItemListQuery(skip=2, limit=5, sort="price_low", category_id="c1", search="x")
        await shop_service.get_items(q)

        mock_shop_repo.get_items.assert_awaited_once_with(
            skip=2, limit=5, sort="price_low", category_id="c1", search="x"
        )
        mock_shop_repo.count_items.assert_awaited_once_with(category_id="c1", search="x")


@pytest.mark.asyncio
class TestGetMyItems:
    async def test_filters_by_seller_and_count(self, shop_service, mock_shop_repo):
        it = make_shop_item()
        mock_shop_repo.get_my_items = AsyncMock(return_value=[it])
        mock_shop_repo.count_items = AsyncMock(return_value=7)

        out = await shop_service.get_my_items("seller-1", ItemPaginationRequest(skip=1, limit=10))

        mock_shop_repo.get_my_items.assert_awaited_once_with("seller-1", 1, 10)
        mock_shop_repo.count_items.assert_awaited_once_with(None, None, "seller-1")
        assert out.total == 7


@pytest.mark.asyncio
class TestUploadItemImages:
    async def test_success_returns_urls(self, shop_service):
        with patch("app.modules.shop.service.upload_files", new=AsyncMock(return_value=["/a.jpg"])) as up:
            urls = await shop_service.upload_item_images("u1", [(b"x", "image/jpeg")])

        up.assert_awaited_once()
        assert urls == ["/a.jpg"]

    async def test_storage_error_raises_bad_request(self, shop_service):
        with patch(
            "app.modules.shop.service.upload_files",
            new=AsyncMock(side_effect=RuntimeError("minio down")),
        ):
            with pytest.raises(BadRequestException) as exc:
                await shop_service.upload_item_images("u1", [(b"x", "image/jpeg")])

            assert exc.value.error_code == "UPLOAD_FAILED"


@pytest.mark.asyncio
class TestCreateItem:
    async def test_passes_payload_to_repo(self, shop_service, mock_shop_repo):
        created = make_shop_item()
        mock_shop_repo.create_item = AsyncMock(return_value=created)
        data = ItemCreate(
            category_id="cat-1",
            title="T",
            description="D" * 5,
            price=10.5,
            image_urls=["https://img/1.png"],
        )

        await shop_service.create_item(data, "seller-99")

        call = mock_shop_repo.create_item.await_args
        assert call[0][0]["sellerId"] == "seller-99"
        assert call[0][0]["price"] == 10.5
        assert call[0][1] == ["https://img/1.png"]


@pytest.mark.asyncio
class TestUpdateItem:
    async def test_not_found(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await shop_service.update_item("i1", ItemUpdate(title="x"), "u1")

    async def test_forbidden_not_owner(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=make_shop_item(sellerId="owner"))

        with pytest.raises(ForbiddenException) as exc:
            await shop_service.update_item("i1", ItemUpdate(title="x"), "intruder")

        assert exc.value.error_code == "ACCESS_DENIED"

    async def test_no_fields_raises_value_error(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=make_shop_item(sellerId="me"))

        with pytest.raises(ValueError, match="No fields"):
            await shop_service.update_item("i1", ItemUpdate(), "me")

    async def test_owner_updates(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=make_shop_item(sellerId="me"))
        mock_shop_repo.update_item = AsyncMock(return_value=make_shop_item(title="New"))

        out = await shop_service.update_item(
            "i1", ItemUpdate(title="New", price=20.0), "me"
        )

        mock_shop_repo.update_item.assert_awaited_once_with(
            "i1", {"title": "New", "price": 20.0}
        )
        assert out.title == "New"


@pytest.mark.asyncio
class TestDeleteItem:
    async def test_not_found(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await shop_service.delete_item("i1", "u1")

    async def test_forbidden(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=make_shop_item(sellerId="a"))

        with pytest.raises(ForbiddenException):
            await shop_service.delete_item("i1", "b")

    async def test_soft_delete(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=make_shop_item(sellerId="me"))
        mock_shop_repo.delete_item = AsyncMock(return_value=make_shop_item())

        await shop_service.delete_item("i1", "me")

        mock_shop_repo.delete_item.assert_awaited_once_with("i1")


@pytest.mark.asyncio
class TestGetHotItems:
    async def test_delegates_sort_rating(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_items = AsyncMock(
            return_value=[make_shop_item(id="a"), make_shop_item(id="b")]
        )

        ids = await shop_service.get_hot_items(10)

        mock_shop_repo.get_items.assert_awaited_once_with(limit=10, sort="rating")
        assert ids == ["a", "b"]
