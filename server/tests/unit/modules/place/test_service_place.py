"""Place CRUD and updates."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ConflictException, NotFoundException
from app.modules.place.schema import PlaceRequest, PlaceUpdateRequest

from .conftest import make_category_row, make_place_row


@pytest.mark.asyncio
class TestCreatePlace:
    async def test_category_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_category_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await place_service.create_place(
                PlaceRequest(
                    name="P",
                    description=None,
                    latitude=1.0,
                    longitude=2.0,
                    address=None,
                    category_id="bad",
                ),
                "u1",
            )

        assert exc.value.error_code == "CATEGORY_NOT_FOUND"

    async def test_success(self, place_service, mock_place_repo):
        mock_place_repo.get_category_by_id = AsyncMock(return_value=make_category_row())
        mock_place_repo.create_place = AsyncMock(return_value=make_place_row())

        await place_service.create_place(
            PlaceRequest(
                name="P",
                description="d",
                latitude=1.0,
                longitude=2.0,
                address="a",
                category_id="pc-1",
            ),
            "owner-1",
        )

        mock_place_repo.create_place.assert_awaited_once()
        data = mock_place_repo.create_place.await_args[0][0]
        assert data["userId"] == "owner-1"


@pytest.mark.asyncio
class TestGetPlaceById:
    async def test_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await place_service.get_place_by_id("x")
        assert exc.value.error_code == "PLACE_NOT_FOUND"

    async def test_found(self, place_service, mock_place_repo):
        p = make_place_row(id="p99", name="Spot")
        mock_place_repo.get_place_by_id = AsyncMock(return_value=p)

        out = await place_service.get_place_by_id("p99")

        assert out.id == "p99"
        assert out.name == "Spot"


@pytest.mark.asyncio
class TestUpdatePlace:
    async def test_place_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await place_service.update_place("p1", PlaceUpdateRequest(name="n"), "u1")

    async def test_not_owner_conflict(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row(userId="a"))

        with pytest.raises(ConflictException) as exc:
            await place_service.update_place("p1", PlaceUpdateRequest(name="n"), "b")

        assert exc.value.error_code == "NOT_PLACE_OWNER"

    async def test_no_update_fields_conflict(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row(userId="me"))

        with pytest.raises(ConflictException) as exc:
            await place_service.update_place("p1", PlaceUpdateRequest(), "me")

        assert exc.value.error_code == "NO_UPDATE_FIELDS"

    async def test_category_change_invalid(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row(userId="me"))
        mock_place_repo.get_category_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await place_service.update_place(
                "p1", PlaceUpdateRequest(category_id="ghost"), "me"
            )

        assert exc.value.error_code == "CATEGORY_NOT_FOUND"

    async def test_owner_updates(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row(userId="me"))
        mock_place_repo.get_category_by_id = AsyncMock(return_value=make_category_row())
        mock_place_repo.update_place = AsyncMock(return_value=make_place_row(name="New"))

        out = await place_service.update_place(
            "p1", PlaceUpdateRequest(name="New", category_id="pc-1"), "me"
        )

        assert out.name == "New"


@pytest.mark.asyncio
class TestDeletePlace:
    async def test_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await place_service.delete_place("p1", "u1")

    async def test_not_owner_conflict(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row(userId="a"))

        with pytest.raises(ConflictException) as exc:
            await place_service.delete_place("p1", "b")

        assert exc.value.error_code == "NOT_PLACE_OWNER"

    async def test_owner_deletes(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row(userId="me"))
        mock_place_repo.delete_place = AsyncMock(return_value=make_place_row())

        await place_service.delete_place("p1", "me")

        mock_place_repo.delete_place.assert_awaited_once_with("p1")
