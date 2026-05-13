"""Documents: upload, list, get, update, delete."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException
from app.modules.documents.schema import DocumentCreate, DocumentListQuery, DocumentPaginationRequest, DocumentUpdate

from .conftest import make_document_row


class TestGetFileType:
    def test_extension_lowercase(self, document_service):
        assert document_service._get_file_type("FILE.PDF") == ".pdf"

    def test_unknown_when_no_dot(self, document_service):
        assert document_service._get_file_type("readme") == "unknown"


@pytest.mark.asyncio
class TestUploadDocument:
    async def test_success(self, document_service, mock_document_repo):
        doc = make_document_row()
        with patch(
            "app.utils.storage.upload_file",
            new=AsyncMock(return_value="https://storage/doc.pdf"),
        ) as up:
            mock_document_repo.create_document = AsyncMock(return_value=doc)

            out = await document_service.upload_document(
                DocumentCreate(title="T", description="d", category_id="c1"),
                b"binary",
                "Notes.pdf",
                "user-1",
            )

        up.assert_awaited_once()
        call_kw = mock_document_repo.create_document.await_args[0][0]
        assert call_kw["fileUrl"] == "https://storage/doc.pdf"
        assert call_kw["fileType"] == ".pdf"
        assert call_kw["fileSize"] == len(b"binary")
        assert out.title == "Lecture"

    async def test_db_failure_triggers_delete_file_rollback(self, document_service, mock_document_repo):
        with patch(
            "app.utils.storage.upload_file",
            new=AsyncMock(return_value="https://rollback/x.pdf"),
        ), patch(
            "app.modules.documents.service.delete_file",
            new=AsyncMock(),
        ) as df:
            mock_document_repo.create_document = AsyncMock(side_effect=RuntimeError("db down"))

            with pytest.raises(RuntimeError, match="db down"):
                await document_service.upload_document(
                    DocumentCreate(title="T", description=None, category_id=None),
                    b"x",
                    "f.pdf",
                    "u1",
                )

            df.assert_awaited_once_with("https://rollback/x.pdf")

    async def test_rollback_delete_failure_swallowed(self, document_service, mock_document_repo):
        with patch(
            "app.utils.storage.upload_file",
            new=AsyncMock(return_value="https://bad/del.pdf"),
        ), patch(
            "app.modules.documents.service.delete_file",
            new=AsyncMock(side_effect=OSError("minio")),
        ):
            mock_document_repo.create_document = AsyncMock(side_effect=ValueError("db"))

            with pytest.raises(ValueError):
                await document_service.upload_document(
                    DocumentCreate(title="T", description=None, category_id=None),
                    b"x",
                    "a.pdf",
                    "u1",
                )


@pytest.mark.asyncio
class TestGetDocuments:
    async def test_pagination(self, document_service, mock_document_repo):
        d = make_document_row()
        mock_document_repo.get_documents = AsyncMock(return_value=[d])
        mock_document_repo.count_documents = AsyncMock(return_value=1)

        q = DocumentListQuery(skip=3, limit=10, sort="oldest", category_id="c", search="q")
        out = await document_service.get_documents(q)

        mock_document_repo.get_documents.assert_awaited_once_with(
            skip=3, limit=10, sort="oldest", category_id="c", search="q"
        )
        mock_document_repo.count_documents.assert_awaited_once_with(category_id="c", search="q")
        assert out.total == 1


@pytest.mark.asyncio
class TestGetMyDocuments:
    async def test_owner_filter(self, document_service, mock_document_repo):
        mock_document_repo.get_my_documents = AsyncMock(return_value=[make_document_row()])
        mock_document_repo.count_documents = AsyncMock(return_value=5)

        out = await document_service.get_my_documents("owner-1", DocumentPaginationRequest(skip=0, limit=5))

        mock_document_repo.count_documents.assert_awaited_once_with(None, None, "owner-1")
        assert out.total == 5


@pytest.mark.asyncio
class TestGetDocumentById:
    async def test_maps(self, document_service, mock_document_repo):
        mock_document_repo.get_document_by_id = AsyncMock(return_value=make_document_row())

        out = await document_service.get_document_by_id("doc-1")

        assert out.id == "doc-1"


@pytest.mark.asyncio
class TestUpdateDocument:
    async def test_not_found(self, document_service, mock_document_repo):
        mock_document_repo.get_document_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await document_service.update_document("d1", DocumentUpdate(title="x"), "u1")

    async def test_forbidden(self, document_service, mock_document_repo):
        mock_document_repo.get_document_by_id = AsyncMock(return_value=make_document_row(userId="other"))

        with pytest.raises(ForbiddenException):
            await document_service.update_document("d1", DocumentUpdate(title="x"), "me")

    async def test_no_fields_value_error(self, document_service, mock_document_repo):
        mock_document_repo.get_document_by_id = AsyncMock(return_value=make_document_row(userId="me"))

        with pytest.raises(ValueError, match="No fields"):
            await document_service.update_document("d1", DocumentUpdate(), "me")

    async def test_owner_updates(self, document_service, mock_document_repo):
        mock_document_repo.get_document_by_id = AsyncMock(return_value=make_document_row(userId="me"))
        mock_document_repo.update_document = AsyncMock(return_value=make_document_row(title="New"))

        out = await document_service.update_document(
            "d1", DocumentUpdate(title="New", category_id="c2"), "me"
        )

        mock_document_repo.update_document.assert_awaited_once_with(
            "d1", {"title": "New", "categoryId": "c2"}
        )
        assert out.title == "New"


@pytest.mark.asyncio
class TestDeleteDocument:
    async def test_not_found(self, document_service, mock_document_repo):
        mock_document_repo.get_document_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await document_service.delete_document("d1", "u1")

    async def test_forbidden(self, document_service, mock_document_repo):
        mock_document_repo.get_document_by_id = AsyncMock(return_value=make_document_row(userId="a"))

        with pytest.raises(ForbiddenException):
            await document_service.delete_document("d1", "b")

    async def test_delete_file_error_still_returns_after_db_delete(
        self, document_service, mock_document_repo
    ):
        doc = make_document_row(userId="me", fileUrl="https://f/x.pdf")
        mock_document_repo.get_document_by_id = AsyncMock(return_value=doc)
        mock_document_repo.delete_document = AsyncMock(return_value=doc)

        with patch(
            "app.modules.documents.service.delete_file",
            new=AsyncMock(side_effect=RuntimeError("storage")),
        ) as df:
            out = await document_service.delete_document("d1", "me")

        df.assert_awaited_once_with("https://f/x.pdf")
        assert out.id == "doc-1"
