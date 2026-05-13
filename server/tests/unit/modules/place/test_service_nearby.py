"""Nearby places service validation and delegation."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import NotFoundException

from .conftest import make_category_row


@pytest.mark.asyncio
class TestGetNearbyPlacesValidation:
    async def test_latitude_out_of_range(self, place_service, mock_place_repo):
        with pytest.raises(ValueError, match="Latitude"):
            await place_service.get_nearby_places(91.0, 0.0, 2.0)

    async def test_longitude_out_of_range(self, place_service, mock_place_repo):
        with pytest.raises(ValueError, match="Longitude"):
            await place_service.get_nearby_places(0.0, 181.0, 2.0)

    async def test_radius_non_positive(self, place_service, mock_place_repo):
        with pytest.raises(ValueError, match="Radius"):
            await place_service.get_nearby_places(0.0, 0.0, 0.0)

    async def test_whitespace_category_skips_lookup(self, place_service, mock_place_repo):
        mock_place_repo.get_category_by_id = AsyncMock()
        mock_place_repo.get_nearby_places = AsyncMock(return_value=[])

        await place_service.get_nearby_places(10.0, 106.0, 5.0, category_id="   \t")

        mock_place_repo.get_category_by_id.assert_not_called()
        mock_place_repo.get_nearby_places.assert_awaited_once_with(10.0, 106.0, 5.0, None)

    async def test_invalid_category_id_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_category_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await place_service.get_nearby_places(0.0, 0.0, 2.0, category_id="missing")

        assert exc.value.error_code == "CATEGORY_NOT_FOUND"

    async def test_valid_category_delegates(self, place_service, mock_place_repo):
        mock_place_repo.get_category_by_id = AsyncMock(return_value=make_category_row())
        mock_place_repo.get_nearby_places = AsyncMock(return_value=[])

        await place_service.get_nearby_places(1.0, 2.0, 3.0, category_id="pc-1")

        mock_place_repo.get_nearby_places.assert_awaited_once_with(1.0, 2.0, 3.0, "pc-1")
