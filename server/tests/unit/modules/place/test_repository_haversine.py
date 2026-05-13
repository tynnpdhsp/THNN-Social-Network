"""PlaceRepository Haversine distance and mapping (no real DB)."""

from __future__ import annotations

import math
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.place.repository import PlaceRepository

from .conftest import make_category_row, make_place_image_row, make_place_row, make_user_row


def _place_at(lat: float, lng: float, pid: str):
    return make_place_row(id=pid, latitude=lat, longitude=lng)


@pytest.mark.asyncio
class TestGetNearbyPlacesHaversine:
    """Earth radius R = 6371 km (repository). Same point → 0 km; ~1° latitude
    separation at same longitude → ~111.19 km (6371 * π/180).
    """

    async def test_distance_zero_same_coordinates(self, mock_db):
        repo = PlaceRepository(mock_db)
        p = _place_at(10.0, 106.0, "a")
        mock_db.place.find_many = AsyncMock(return_value=[p])

        out = await repo.get_nearby_places(10.0, 106.0, 50.0, None)

        assert len(out) == 1
        assert out[0].distance == pytest.approx(0.0, abs=1e-9)

    async def test_one_degree_latitude_separation(self, mock_db):
        repo = PlaceRepository(mock_db)
        p = _place_at(1.0, 0.0, "far")
        mock_db.place.find_many = AsyncMock(return_value=[p])

        out = await repo.get_nearby_places(0.0, 0.0, 5000.0, None)

        expected_km = 6371.0 * math.radians(1.0)
        assert len(out) == 1
        assert out[0].distance == pytest.approx(expected_km, rel=1e-5)

    async def test_radius_filter_excludes_far_place(self, mock_db):
        repo = PlaceRepository(mock_db)
        near = _place_at(0.0, 0.0, "n")
        far = _place_at(2.0, 0.0, "f")
        mock_db.place.find_many = AsyncMock(return_value=[near, far])

        out = await repo.get_nearby_places(0.0, 0.0, 50.0, None)

        ids = {x.id for x in out}
        assert "n" in ids
        assert "f" not in ids

    async def test_sorted_by_distance(self, mock_db):
        repo = PlaceRepository(mock_db)
        a = _place_at(0.1, 0.0, "a")
        b = _place_at(0.05, 0.0, "b")
        mock_db.place.find_many = AsyncMock(return_value=[a, b])

        out = await repo.get_nearby_places(0.0, 0.0, 500.0, None)

        assert [x.id for x in out] == ["b", "a"]

    async def test_category_filter_passed_to_query(self, mock_db):
        repo = PlaceRepository(mock_db)
        mock_db.place.find_many = AsyncMock(return_value=[])

        await repo.get_nearby_places(0.0, 0.0, 10.0, "cat-9")

        mock_db.place.find_many.assert_awaited_once()
        call_kw = mock_db.place.find_many.await_args.kwargs
        assert call_kw["where"] == {"categoryId": "cat-9"}


@pytest.mark.asyncio
class TestMapNearbyPlaceToResponse:
    async def test_embeds_user_category_images(self, mock_db):
        repo = PlaceRepository(mock_db)
        p = make_place_row(
            id="p1",
            name="N",
            user=make_user_row("u1", "Owner"),
            category=make_category_row("c1", "Café", "☕"),
            placeImages=[make_place_image_row("i1", "p1", "https://x/1.jpg", 0)],
        )

        resp = repo._map_nearby_place_to_response(p, 12.34)

        assert resp.distance == 12.34
        assert resp.user_info is not None
        assert resp.user_info.id == "u1"
        assert resp.category is not None
        assert resp.category.id == "c1"
        assert resp.images is not None
        assert len(resp.images) == 1
        assert resp.images[0].image_url == "https://x/1.jpg"

    async def test_images_fallback_attribute(self, mock_db):
        repo = PlaceRepository(mock_db)
        p = MagicMock()
        p.id = "p2"
        p.name = "X"
        p.description = None
        p.latitude = 0.0
        p.longitude = 0.0
        p.address = None
        p.avgRating = 0.0
        p.ratingCount = 0
        p.user = None
        p.category = None
        p.placeImages = []
        img = make_place_image_row("i2", "p2")
        p.images = [img]

        resp = repo._map_nearby_place_to_response(p, 1.0)

        assert len(resp.images) == 1
        assert resp.images[0].id == "i2"
