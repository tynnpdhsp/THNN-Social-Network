"""Document category CRUD."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ConflictException, NotFoundException
from app.modules.documents.schema import DocumentCategoryRequest

from .conftest import make_category_row


@pytest.mark.asyncio
class TestCreateDocumentCategory:
    async def test_name_conflict(self, document_service, mock_document_repo):
        mock_document_repo.get_category_by_name = AsyncMock(return_value=make_category_row())

        with pytest.raises(ConflictException) as exc:
            await document_service.create_document_category(DocumentCategoryRequest(name="Dup"))

        assert exc.value.error_code == "CATEGORY_NAME_EXISTS"

    async def test_creates(self, document_service, mock_document_repo):
        mock_document_repo.get_category_by_name = AsyncMock(return_value=None)
        created = make_category_row(name="New")
        mock_document_repo.create_document_category = AsyncMock(return_value=created)

        out = await document_service.create_document_category(DocumentCategoryRequest(name="New"))

        mock_document_repo.create_document_category.assert_awaited_once_with({"name": "New"})
        assert out.name == "New"


@pytest.mark.asyncio
class TestGetAllCategory:
    async def test_maps(self, document_service, mock_document_repo):
        mock_document_repo.get_all_category = AsyncMock(
            return_value=[make_category_row("a", "A"), make_category_row("b", "B")]
        )

        out = await document_service.get_all_category()

        assert len(out) == 2


@pytest.mark.asyncio
class TestUpdateDocumentCategory:
    async def test_not_found(self, document_service, mock_document_repo):
        mock_document_repo.get_category_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await document_service.update_document_category("x", DocumentCategoryRequest(name="Y"))

    async def test_name_clash_other_id(self, document_service, mock_document_repo):
        mock_document_repo.get_category_by_id = AsyncMock(return_value=make_category_row("self", "Old"))
        mock_document_repo.get_category_by_name = AsyncMock(return_value=make_category_row("other", "Taken"))

        with pytest.raises(ConflictException):
            await document_service.update_document_category("self", DocumentCategoryRequest(name="Taken"))

    async def test_same_name_same_id_ok(self, document_service, mock_document_repo):
        row = make_category_row("id-1", "Name")
        mock_document_repo.get_category_by_id = AsyncMock(return_value=row)
        mock_document_repo.get_category_by_name = AsyncMock(return_value=row)
        mock_document_repo.update_document_category = AsyncMock(return_value=row)

        await document_service.update_document_category("id-1", DocumentCategoryRequest(name="Name"))

        mock_document_repo.update_document_category.assert_awaited_once()


@pytest.mark.asyncio
class TestDeleteDocumentCategory:
    async def test_not_found(self, document_service, mock_document_repo):
        mock_document_repo.get_category_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await document_service.delete_document_category("missing")

    async def test_deletes(self, document_service, mock_document_repo):
        mock_document_repo.get_category_by_id = AsyncMock(return_value=make_category_row())
        mock_document_repo.delete_document_category = AsyncMock(return_value=make_category_row())

        await document_service.delete_document_category("dc-1")

        mock_document_repo.delete_document_category.assert_awaited_once_with("dc-1")
