"""Place bookmarks."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import NotFoundException

from .conftest import make_bookmark_row, make_place_row


@pytest.mark.asyncio
class TestToggleBookmark:
    async def test_place_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await place_service.toggle_place_bookmark("p1", "u1")

    async def test_removes_existing(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row())
        bm = make_bookmark_row(bid="b1", uid="u1", pid="p1")
        mock_place_repo.get_user_bookmark = AsyncMock(return_value=bm)
        mock_place_repo.delete_bookmark = AsyncMock(return_value=bm)

        out = await place_service.toggle_place_bookmark("p1", "u1")

        assert out.id == "b1"
        mock_place_repo.delete_bookmark.assert_awaited_once_with("u1", "p1")
        mock_place_repo.create_bookmark.assert_not_called()

    async def test_creates_when_absent(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row())
        mock_place_repo.get_user_bookmark = AsyncMock(return_value=None)
        created = make_bookmark_row(bid="b-new", uid="u1", pid="p1")
        mock_place_repo.create_bookmark = AsyncMock(return_value=created)

        out = await place_service.toggle_place_bookmark("p1", "u1")

        assert out.id == "b-new"
        mock_place_repo.create_bookmark.assert_awaited_once_with("u1", "p1")


@pytest.mark.asyncio
class TestGetUserBookmarks:
    async def test_maps_and_totals(self, place_service, mock_place_repo):
        bm = make_bookmark_row()
        mock_place_repo.get_user_bookmarks = AsyncMock(return_value=[bm])
        mock_place_repo.count_user_bookmarks = AsyncMock(return_value=3)

        out = await place_service.get_user_bookmarks("u1", skip=0, limit=20)

        assert out.total == 3
        assert len(out.items) == 1
        assert out.items[0].id == bm.place.id
        mock_place_repo.get_user_bookmarks.assert_awaited_once_with("u1", 0, 20)


@pytest.mark.asyncio
class TestCheckPlaceBookmark:
    async def test_place_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await place_service.check_place_bookmark("p1", "u1")

    async def test_true(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row())
        mock_place_repo.get_user_bookmark = AsyncMock(return_value=make_bookmark_row())

        out = await place_service.check_place_bookmark("p1", "u1")

        assert out.is_bookmarked is True
        assert out.bookmark_id is not None

    async def test_false(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row())
        mock_place_repo.get_user_bookmark = AsyncMock(return_value=None)

        out = await place_service.check_place_bookmark("p1", "u1")

        assert out.is_bookmarked is False
        assert out.bookmark_id is None
