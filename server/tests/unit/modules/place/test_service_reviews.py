"""Place reviews."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.modules.place.schema import ReviewRequest

from .conftest import make_place_row, make_review_row


@pytest.mark.asyncio
class TestCreatePlaceReview:
    async def test_place_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await place_service.create_place_review(
                "p1", "u1", ReviewRequest(rating=5, comment="x")
            )
        assert exc.value.error_code == "PLACE_NOT_FOUND"

    async def test_user_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row())
        mock_place_repo.db.user.find_unique = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await place_service.create_place_review(
                "p1", "ghost", ReviewRequest(rating=5)
            )
        assert exc.value.error_code == "USER_NOT_FOUND"

    async def test_duplicate_user_rated(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row())
        u = MagicMock()
        u.id = "u1"
        u.fullName = "Me"
        u.avatarUrl = None
        mock_place_repo.db.user.find_unique = AsyncMock(return_value=u)
        mock_place_repo.get_user_review = AsyncMock(return_value=make_review_row())

        with pytest.raises(BadRequestException) as exc:
            await place_service.create_place_review(
                "p1", "u1", ReviewRequest(rating=4, comment="again")
            )
        assert exc.value.error_code == "USER_RATED"

    async def test_creates(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row())
        u = MagicMock()
        u.id = "u1"
        u.fullName = "Me"
        u.avatarUrl = "https://a.png"
        mock_place_repo.db.user.find_unique = AsyncMock(return_value=u)
        mock_place_repo.get_user_review = AsyncMock(return_value=None)
        new_r = make_review_row(rid="r-new", uid="u1")
        mock_place_repo.create_review_with_transaction = AsyncMock(return_value=new_r)

        out = await place_service.create_place_review(
            "p1", "u1", ReviewRequest(rating=5, comment="great")
        )

        assert out.id == "r-new"
        mock_place_repo.create_review_with_transaction.assert_awaited_once()
        args = mock_place_repo.create_review_with_transaction.await_args[0]
        assert args[0] == "p1"
        assert args[1] == "u1"
        assert args[3] == 5
        assert args[4] == "great"


@pytest.mark.asyncio
class TestGetPlaceReviews:
    async def test_place_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await place_service.get_place_reviews("p1")

    async def test_pagination_passed(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row())
        mock_place_repo.get_place_reviews = AsyncMock(return_value=[])
        mock_place_repo.count_reviews = AsyncMock(return_value=0)

        await place_service.get_place_reviews("p1", skip=5, limit=10)

        mock_place_repo.get_place_reviews.assert_awaited_once_with("p1", 5, 10)
        mock_place_repo.count_reviews.assert_awaited_once_with("p1")


@pytest.mark.asyncio
class TestDeletePlaceReview:
    async def test_review_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_review_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await place_service.delete_place_review("r1", "u1")
        assert exc.value.error_code == "REVIEW_NOT_FOUND"

    async def test_not_owner(self, place_service, mock_place_repo):
        r = make_review_row(uid="other")
        mock_place_repo.get_review_by_id = AsyncMock(return_value=r)

        with pytest.raises(ForbiddenException) as exc:
            await place_service.delete_place_review("r1", "u1")
        assert exc.value.error_code == "Forbidden_DELETE_REVIEW"

    async def test_deletes(self, place_service, mock_place_repo):
        r = make_review_row(uid="u1")
        mock_place_repo.get_review_by_id = AsyncMock(return_value=r)
        mock_place_repo.delete_review_with_transaction = AsyncMock(
            return_value={"avg_rating": 0.0, "rating_count": 0, "message": "ok"}
        )

        out = await place_service.delete_place_review("r1", "u1")

        assert out["rating_count"] == 0
        mock_place_repo.delete_review_with_transaction.assert_awaited_once_with("r1")
