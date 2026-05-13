"""Unit tests for ``NotificationService._map_to_response``."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.modules.notification.schemas import NotificationMetadata

from .conftest import make_notification_row


class TestMapToResponse:
    def test_metadata_none_when_row_has_no_metadata(self, notification_service):
        row = make_notification_row(metadata=None)
        res = notification_service._map_to_response(row)
        assert res.metadata is None

    def test_metadata_from_dict(self, notification_service):
        row = make_notification_row(
            metadata={"reference_id": "post-9", "reference_type": "post"},
        )
        res = notification_service._map_to_response(row)
        assert res.metadata == NotificationMetadata(
            reference_id="post-9",
            reference_type="post",
        )

    def test_metadata_partial_dict_uses_none_for_missing_keys(self, notification_service):
        row = make_notification_row(metadata={"reference_id": "only-id"})
        res = notification_service._map_to_response(row)
        assert res.metadata is not None
        assert res.metadata.reference_id == "only-id"
        assert res.metadata.reference_type is None

    def test_metadata_non_dict_treated_as_no_metadata(self, notification_service):
        row = make_notification_row(metadata="not-a-dict")
        res = notification_service._map_to_response(row)
        assert res.metadata is None

    def test_empty_dict_metadata_falsy_skips_parse(self, notification_service):
        row = make_notification_row(metadata={})
        res = notification_service._map_to_response(row)
        assert res.metadata is None

    def test_scalar_fields_passthrough(self, notification_service):
        created = datetime(2024, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
        row = make_notification_row(
            id="nid",
            userId="uid",
            type="system",
            title="Hello",
            content="World",
            isRead=True,
            createdAt=created,
        )
        res = notification_service._map_to_response(row)
        assert res.id == "nid"
        assert res.user_id == "uid"
        assert res.type == "system"
        assert res.title == "Hello"
        assert res.content == "World"
        assert res.is_read is True
        assert res.created_at == created
