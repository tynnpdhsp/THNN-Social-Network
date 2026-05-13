"""
Unit tests for ``app/utils/storage.py``.

All MinIO I/O is mocked — no real object store needed.

Covers:
- _guess_content_type: known extensions, unknown fallback
- _build_public_storage_path: correct format
- upload_file: bucket creation when missing, correct extension, content-type
- upload_files: multiple files, executor usage
- delete_file: parse URL /bucket/key; S3Error → False; success → True
"""

from __future__ import annotations

import io
from unittest.mock import MagicMock, patch, AsyncMock

import pytest

from app.utils.storage import (
    _guess_content_type,
    _build_public_storage_path,
    upload_file,
    upload_files,
    delete_file,
)
from app.core.config import get_settings

settings = get_settings()


# ─── _guess_content_type ──────────────────────────────────────────────────────

class TestGuessContentType:
    def test_jpg(self):
        assert _guess_content_type("jpg") == "image/jpeg"

    def test_jpeg(self):
        assert _guess_content_type("jpeg") == "image/jpeg"

    def test_png(self):
        assert _guess_content_type("png") == "image/png"

    def test_gif(self):
        assert _guess_content_type("gif") == "image/gif"

    def test_webp(self):
        assert _guess_content_type("webp") == "image/webp"

    def test_pdf(self):
        assert _guess_content_type("pdf") == "application/pdf"

    def test_doc(self):
        assert _guess_content_type("doc") == "application/msword"

    def test_docx(self):
        assert _guess_content_type("docx") == \
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    def test_unknown_extension(self):
        assert _guess_content_type("xyz") == "application/octet-stream"

    def test_case_insensitive(self):
        assert _guess_content_type("JPG") == "image/jpeg"
        assert _guess_content_type("Png") == "image/png"

    def test_empty_string(self):
        assert _guess_content_type("") == "application/octet-stream"


# ─── _build_public_storage_path ───────────────────────────────────────────────

class TestBuildPublicStoragePath:
    def test_correct_format(self):
        result = _build_public_storage_path("avatars/abc123.jpg")
        assert result == f"/{settings.MINIO_BUCKET}/avatars/abc123.jpg"

    def test_nested_path(self):
        result = _build_public_storage_path("a/b/c/file.pdf")
        assert result == f"/{settings.MINIO_BUCKET}/a/b/c/file.pdf"


# ─── upload_file ──────────────────────────────────────────────────────────────

class TestUploadFile:
    @pytest.mark.asyncio
    async def test_upload_returns_path(self, mock_minio_client):
        url = await upload_file(b"content", "photo.jpg", "avatars")

        assert url.startswith(f"/{settings.MINIO_BUCKET}/avatars/")
        assert url.endswith(".jpg")

    @pytest.mark.asyncio
    async def test_upload_creates_bucket_if_missing(self, mock_minio_client):
        mock_minio_client.bucket_exists.return_value = False

        await upload_file(b"data", "file.png", "images")

        mock_minio_client.make_bucket.assert_called_once_with(settings.MINIO_BUCKET)

    @pytest.mark.asyncio
    async def test_upload_does_not_create_bucket_if_exists(self, mock_minio_client):
        mock_minio_client.bucket_exists.return_value = True

        await upload_file(b"data", "file.png", "images")

        mock_minio_client.make_bucket.assert_not_called()

    @pytest.mark.asyncio
    async def test_upload_correct_content_type(self, mock_minio_client):
        await upload_file(b"data", "doc.pdf", "docs")

        call_kwargs = mock_minio_client.put_object.call_args
        assert call_kwargs.kwargs.get("content_type") == "application/pdf" or \
            call_kwargs[1].get("content_type") == "application/pdf"

    @pytest.mark.asyncio
    async def test_upload_filename_without_extension(self, mock_minio_client):
        """Filename without '.' → extension defaults to 'bin'."""
        url = await upload_file(b"raw", "noext", "misc")
        assert url.endswith(".bin")

    @pytest.mark.asyncio
    async def test_put_object_called(self, mock_minio_client):
        await upload_file(b"hello", "test.txt", "prefix")
        mock_minio_client.put_object.assert_called_once()


# ─── upload_files ─────────────────────────────────────────────────────────────

class TestUploadFiles:
    @pytest.mark.asyncio
    async def test_upload_multiple(self, mock_minio_client):
        files = [(b"a", "a.jpg"), (b"b", "b.png")]
        urls = await upload_files(files, "gallery")

        assert len(urls) == 2
        assert all(u.startswith(f"/{settings.MINIO_BUCKET}/gallery/") for u in urls)

    @pytest.mark.asyncio
    async def test_upload_empty_list(self, mock_minio_client):
        urls = await upload_files([], "empty")
        assert urls == []


# ─── delete_file ──────────────────────────────────────────────────────────────

class TestDeleteFile:
    @pytest.mark.asyncio
    async def test_delete_success(self, mock_minio_client):
        result = await delete_file(f"/{settings.MINIO_BUCKET}/avatars/abc.jpg")
        assert result is True
        mock_minio_client.remove_object.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_parses_bucket_prefix(self, mock_minio_client):
        await delete_file(f"/{settings.MINIO_BUCKET}/images/xyz.png")

        call_args = mock_minio_client.remove_object.call_args
        assert call_args[0][0] == settings.MINIO_BUCKET
        assert call_args[0][1] == "images/xyz.png"

    @pytest.mark.asyncio
    async def test_delete_raw_object_name(self, mock_minio_client):
        """If URL doesn't contain /bucket/ prefix, use as-is."""
        await delete_file("some/object/path.txt")

        call_args = mock_minio_client.remove_object.call_args
        assert call_args[0][1] == "some/object/path.txt"

    @pytest.mark.asyncio
    async def test_delete_s3error_returns_false(self, mock_minio_client):
        from minio.error import S3Error

        mock_minio_client.remove_object.side_effect = S3Error(
            "NoSuchKey", "NoSuchKey", "resource", "req-id", "host-id", "response"
        )
        result = await delete_file(f"/{settings.MINIO_BUCKET}/miss.jpg")
        assert result is False
