"""Pydantic rules for document schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.modules.documents.schema import DocumentCreate, ReviewCreate


def test_document_create_title_required_length():
    with pytest.raises(ValidationError):
        DocumentCreate(title="", description=None, category_id=None)


def test_review_create_rating_range():
    with pytest.raises(ValidationError):
        ReviewCreate(rating=0, comment=None)
