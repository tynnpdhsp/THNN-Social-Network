"""Reviews on documents (same patterns as shop reviews)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException
from app.modules.documents.schema import ReviewCreate

from .conftest import make_document_row, make_review_row


@pytest.mark.asyncio
class TestCreateDocumentReview:
    async def test_document_not_found(self, document_service, mock_document_repo, mock_db):
        mock_document_repo.get_document_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await document_service.create_document_review(
                "doc-1", "u1", ReviewCreate(rating=5, comment="x")
            )

        assert exc.value.error_code == "DOCUMENT_NOT_FOUND"

    async def test_user_not_found(self, document_service, mock_document_repo, mock_db):
        mock_document_repo.get_document_by_id = AsyncMock(return_value=make_document_row())
        mock_db.user.find_unique = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await document_service.create_document_review("doc-1", "ghost", ReviewCreate(rating=4))

        assert exc.value.error_code == "USER_NOT_FOUND"

    async def test_success(self, document_service, mock_document_repo, mock_db):
        mock_document_repo.get_document_by_id = AsyncMock(return_value=make_document_row())
        u = MagicMock()
        u.id = "u1"
        u.fullName = "Bob"
        u.avatarUrl = None
        mock_db.user.find_unique = AsyncMock(return_value=u)
        rev = make_review_row()
        mock_document_repo.create_review_with_transaction = AsyncMock(return_value=(rev, {}))

        out = await document_service.create_document_review(
            "doc-1", "u1", ReviewCreate(rating=5, comment="nice")
        )

        mock_document_repo.create_review_with_transaction.assert_awaited_once()
        args = mock_document_repo.create_review_with_transaction.await_args[0]
        assert args[0] == "doc-1"
        assert args[1] == "u1"
        assert args[3] == 5
        assert args[4] == "nice"
        assert out.rating == 5


@pytest.mark.asyncio
class TestGetDocumentReviews:
    async def test_document_missing(self, document_service, mock_document_repo):
        mock_document_repo.get_document_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await document_service.get_document_reviews("doc-1")

    async def test_lists(self, document_service, mock_document_repo):
        mock_document_repo.get_document_by_id = AsyncMock(return_value=make_document_row())
        mock_document_repo.get_document_reviews = AsyncMock(return_value=[make_review_row()])
        mock_document_repo.count_reviews = AsyncMock(return_value=3)

        out = await document_service.get_document_reviews("doc-1", skip=2, limit=5)

        assert out.total == 3
        assert len(out.items) == 1


@pytest.mark.asyncio
class TestDeleteDocumentReview:
    async def test_not_found(self, document_service, mock_document_repo):
        mock_document_repo.get_review_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await document_service.delete_document_review("r1", "u1")

    async def test_not_owner(self, document_service, mock_document_repo):
        mock_document_repo.get_review_by_id = AsyncMock(
            return_value=make_review_row(user_id_in_info="other")
        )

        with pytest.raises(ForbiddenException) as exc:
            await document_service.delete_document_review("r1", "u1")

        assert exc.value.error_code == "Forbidden_DELETE_REVIEW"

    async def test_success(self, document_service, mock_document_repo):
        mock_document_repo.get_review_by_id = AsyncMock(
            return_value=make_review_row(user_id_in_info="u1")
        )
        mock_document_repo.delete_review_with_transaction = AsyncMock(return_value={"deleted": True})

        out = await document_service.delete_document_review("r1", "u1")

        assert out == {"deleted": True}
