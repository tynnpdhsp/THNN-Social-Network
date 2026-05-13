"""Category CRUD on ``ShopService``."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ConflictException, NotFoundException
from app.modules.shop.schemas import CategoryCreate, CategoryUpdate

from .conftest import make_category_row


@pytest.mark.asyncio
class TestCreateCategory:
    async def test_conflict_when_name_exists(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_category_by_name = AsyncMock(return_value=make_category_row())

        with pytest.raises(ConflictException) as exc:
            await shop_service.create_category(CategoryCreate(name="Dup", description=None))

        assert exc.value.error_code == "CATEGORY_NAME_EXISTS"

    async def test_creates_when_unique(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_category_by_name = AsyncMock(return_value=None)
        created = make_category_row(name="New")
        mock_shop_repo.create_category = AsyncMock(return_value=created)

        out = await shop_service.create_category(CategoryCreate(name="New", description="d"))

        mock_shop_repo.create_category.assert_awaited_once_with(
            {"name": "New", "description": "d"}
        )
        assert out.name == "New"


@pytest.mark.asyncio
class TestGetAllCategories:
    async def test_maps_responses(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_all_categories = AsyncMock(
            return_value=[make_category_row("c1", "A"), make_category_row("c2", "B")]
        )

        out = await shop_service.get_all_categories()

        assert len(out) == 2
        assert out[0].id == "c1"


@pytest.mark.asyncio
class TestUpdateCategory:
    async def test_not_found(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_category_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await shop_service.update_category("x", CategoryUpdate(name="Y"))

        assert exc.value.error_code == "CATEGORY_NOT_FOUND"

    async def test_name_conflict_with_other_id(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_category_by_id = AsyncMock(return_value=make_category_row("self-id"))
        other = make_category_row("other-id", name="Taken")
        mock_shop_repo.get_category_by_name = AsyncMock(return_value=other)

        with pytest.raises(ConflictException) as exc:
            await shop_service.update_category("self-id", CategoryUpdate(name="Taken"))

        assert exc.value.error_code == "CATEGORY_NAME_EXISTS"

    async def test_same_name_same_id_allowed(self, shop_service, mock_shop_repo):
        self_c = make_category_row("same", name="Name")
        mock_shop_repo.get_category_by_id = AsyncMock(return_value=self_c)
        mock_shop_repo.get_category_by_name = AsyncMock(return_value=self_c)
        updated = make_category_row("same", name="Name")
        mock_shop_repo.update_category = AsyncMock(return_value=updated)

        out = await shop_service.update_category("same", CategoryUpdate(name="Name"))

        assert out.id == "same"


@pytest.mark.asyncio
class TestDeleteCategory:
    async def test_not_found(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_category_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await shop_service.delete_category("missing")

    async def test_deletes(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_category_by_id = AsyncMock(return_value=make_category_row())
        mock_shop_repo.delete_category = AsyncMock(return_value=make_category_row())

        await shop_service.delete_category("cat-1")

        mock_shop_repo.delete_category.assert_awaited_once_with("cat-1")
