"""Place category: create duplicate, delete not found."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ConflictException, NotFoundException
from app.modules.place.schema import PlaceCategoryRequest

from .conftest import make_category_row


@pytest.mark.asyncio
class TestCreatePlaceCategory:
    async def test_duplicate_name_conflict(self, place_service, mock_place_repo):
        mock_place_repo.get_category_by_name = AsyncMock(return_value=make_category_row())

        with pytest.raises(ConflictException) as exc:
            await place_service.create_place_category(PlaceCategoryRequest(name="Dup"))

        assert exc.value.error_code == "CATEGORY_NAME_EXISTS"

    async def test_creates(self, place_service, mock_place_repo):
        mock_place_repo.get_category_by_name = AsyncMock(return_value=None)
        created = make_category_row(name="New")
        mock_place_repo.create_place_category = AsyncMock(return_value=created)

        await place_service.create_place_category(PlaceCategoryRequest(name="New", icon="i"))

        mock_place_repo.create_place_category.assert_awaited_once()
        dumped = mock_place_repo.create_place_category.await_args[0][0]
        assert dumped["name"] == "New"
        assert dumped["icon"] == "i"


@pytest.mark.asyncio
class TestGetAllCategory:
    async def test_maps(self, place_service, mock_place_repo):
        mock_place_repo.get_all_category = AsyncMock(return_value=[make_category_row()])

        out = await place_service.get_all_category()

        assert len(out) == 1


@pytest.mark.asyncio
class TestDeletePlaceCategory:
    async def test_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_category_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await place_service.delete_place_category("missing")
        assert exc.value.error_code == "CATEGORY_NOT_FOUND"

    async def test_deletes(self, place_service, mock_place_repo):
        mock_place_repo.get_category_by_id = AsyncMock(return_value=make_category_row())
        mock_place_repo.delete_place_category = AsyncMock(return_value=make_category_row())

        await place_service.delete_place_category("pc-1")

        mock_place_repo.delete_place_category.assert_awaited_once_with("pc-1")
