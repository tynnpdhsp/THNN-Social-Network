"""Item reviews."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException
from app.modules.shop.schemas import ReviewCreate

from .conftest import make_review_row, make_shop_item


@pytest.mark.asyncio
class TestCreateItemReview:
    async def test_item_not_found(self, shop_service, mock_shop_repo, mock_db):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await shop_service.create_item_review(
                "item-1", "u1", ReviewCreate(rating=5, comment="x")
            )

        assert exc.value.error_code == "ITEM_NOT_FOUND"

    async def test_user_not_found(self, shop_service, mock_shop_repo, mock_db):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=make_shop_item())
        mock_db.user.find_unique = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await shop_service.create_item_review(
                "item-1", "ghost", ReviewCreate(rating=4)
            )

        assert exc.value.error_code == "USER_NOT_FOUND"

    async def test_success(self, shop_service, mock_shop_repo, mock_db):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=make_shop_item())
        user = MagicMock()
        user.id = "u1"
        user.fullName = "Alice"
        user.avatarUrl = None
        mock_db.user.find_unique = AsyncMock(return_value=user)
        rev = make_review_row()
        mock_shop_repo.create_review_with_transaction = AsyncMock(return_value=(rev, {}))

        out = await shop_service.create_item_review(
            "item-1", "u1", ReviewCreate(rating=5, comment="ok")
        )

        mock_shop_repo.create_review_with_transaction.assert_awaited_once()
        call = mock_shop_repo.create_review_with_transaction.await_args
        assert call[0][0] == "item-1"
        assert call[0][1] == "u1"
        assert call[0][3] == 5
        assert call[0][4] == "ok"
        assert out.rating == 5


@pytest.mark.asyncio
class TestGetItemReviews:
    async def test_item_missing(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await shop_service.get_item_reviews("item-1")

    async def test_lists(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_item_by_id = AsyncMock(return_value=make_shop_item())
        mock_shop_repo.get_item_reviews = AsyncMock(return_value=[make_review_row()])
        mock_shop_repo.count_reviews = AsyncMock(return_value=9)

        out = await shop_service.get_item_reviews("item-1", skip=1, limit=5)

        assert out.total == 9
        assert len(out.items) == 1


@pytest.mark.asyncio
class TestDeleteItemReview:
    async def test_review_not_found(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_review_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await shop_service.delete_item_review("r1", "u1")

    async def test_not_owner(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_review_by_id = AsyncMock(
            return_value=make_review_row(user_id_in_info="other")
        )

        with pytest.raises(ForbiddenException) as exc:
            await shop_service.delete_item_review("r1", "u1")

        assert exc.value.error_code == "Forbidden_DELETE_REVIEW"

    async def test_success(self, shop_service, mock_shop_repo):
        mock_shop_repo.get_review_by_id = AsyncMock(
            return_value=make_review_row(user_id_in_info="u1")
        )
        mock_shop_repo.delete_review_with_transaction = AsyncMock(return_value={"ok": True})

        out = await shop_service.delete_item_review("r1", "u1")

        assert out == {"ok": True}
