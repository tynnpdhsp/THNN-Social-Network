"""Document module unit test helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture(autouse=True)
def fresh_document_repo_methods(mock_document_repo):
    for name in (
        "get_category_by_name",
        "create_document_category",
        "get_all_category",
        "get_category_by_id",
        "update_document_category",
        "delete_document_category",
        "create_document",
        "get_documents",
        "count_documents",
        "get_document_by_id",
        "get_my_documents",
        "delete_document",
        "update_document",
        "create_review_with_transaction",
        "get_document_reviews",
        "count_reviews",
        "get_review_by_id",
        "delete_review_with_transaction",
    ):
        setattr(mock_document_repo, name, AsyncMock())
    yield


def make_category_row(cid="dc-1", name="Notes"):
    c = MagicMock()
    c.id = cid
    c.name = name
    return c


def make_document_row(**kwargs):
    d = MagicMock()
    defaults = dict(
        id="doc-1",
        userId="owner-1",
        categoryId="dc-1",
        title="Lecture",
        description="Desc",
        fileUrl="https://minio/bucket/doc.pdf",
        fileName="doc.pdf",
        fileSize=1024,
        fileType=".pdf",
        avgRating=4.0,
        ratingCount=2,
        downloadCount=10,
        createdAt=datetime(2025, 5, 1, tzinfo=timezone.utc),
        updatedAt=datetime(2025, 5, 2, tzinfo=timezone.utc),
        user=None,
        category=None,
    )
    for k, v in {**defaults, **kwargs}.items():
        setattr(d, k, v)
    return d


def make_review_row(rid="dr-1", target_id="doc-1", user_id_in_info="u-1"):
    r = MagicMock()
    r.id = rid
    r.targetId = target_id
    r.targetType = "document"
    r.userInfo = {"id": user_id_in_info, "full_name": "R", "avatar_url": None}
    r.rating = 5
    r.comment = "ok"
    r.createdAt = datetime(2025, 5, 3, tzinfo=timezone.utc)
    return r
