"""
Unit tests for ``AccountService.search_users`` and ``get_order_history``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from tests.unit.conftest import make_fake_user, make_fake_role


def _search_user(uid, name="SearchUser"):
    u = make_fake_user(
        id=uid,
        fullName=name,
        emailVerified=True,
        avatarUrl=None,
        coverUrl=None,
    )
    u.roleRef = make_fake_role(role="student")
    return u


@pytest.mark.asyncio
class TestSearchUsers:
    async def test_no_requester_returns_results_with_none_status(
        self, account_service, mock_account_repo, patch_get_redis
    ):
        u = _search_user("s1")
        mock_account_repo.search_users.return_value = [u]

        results = await account_service.search_users("ab", requesting_user_id=None)
        assert len(results) == 1
        assert results[0].friend_status == "none"

    async def test_me_status(self, account_service, mock_account_repo, patch_get_redis):
        u = _search_user("me-id")
        mock_account_repo.search_users.return_value = [u]

        results = await account_service.search_users("me", requesting_user_id="me-id")
        assert results[0].friend_status == "me"

    async def test_accepted_friend(self, account_service, mock_account_repo, patch_get_redis):
        friend = _search_user("f1")
        mock_account_repo.search_users.return_value = [friend]

        calls = []

        async def find_many(**kwargs):
            calls.append(kwargs.get("where"))
            w = kwargs.get("where") or {}
            if w.get("status") == "accepted":
                m = MagicMock()
                m.requesterId = "me-id"
                m.receiverId = "f1"
                return [m]
            return []

        mock_account_repo.db.friendship.find_many = find_many

        results = await account_service.search_users("f", requesting_user_id="me-id")
        assert results[0].friend_status == "accepted"
        assert len(calls) >= 1

    async def test_pending_sent(self, account_service, mock_account_repo, patch_get_redis):
        other = _search_user("pending-target")
        mock_account_repo.search_users.return_value = [other]

        async def find_many(**kwargs):
            w = kwargs.get("where") or {}
            if w.get("status") == "accepted":
                return []
            m = MagicMock()
            m.requesterId = "me-id"
            m.receiverId = "pending-target"
            m.status = "pending"
            return [m]

        mock_account_repo.db.friendship.find_many = find_many

        results = await account_service.search_users("pe", requesting_user_id="me-id")
        assert results[0].friend_status == "pending"

    async def test_pending_received(self, account_service, mock_account_repo, patch_get_redis):
        other = _search_user("from-someone")
        mock_account_repo.search_users.return_value = [other]

        async def find_many(**kwargs):
            w = kwargs.get("where") or {}
            if w.get("status") == "accepted":
                return []
            m = MagicMock()
            m.requesterId = "from-someone"
            m.receiverId = "me-id"
            m.status = "pending"
            return [m]

        mock_account_repo.db.friendship.find_many = find_many

        results = await account_service.search_users("from", requesting_user_id="me-id")
        assert results[0].friend_status == "pending_received"


@pytest.mark.asyncio
class TestGetOrderHistory:
    async def test_maps_orders_and_total(self, account_service, mock_account_repo, patch_get_redis):
        item = MagicMock()
        item.title = "Book A"
        o = MagicMock()
        o.id = "ord-1"
        o.item = item
        o.amount = 120.5
        o.status = "paid"
        o.paidAt = datetime(2025, 1, 2, tzinfo=timezone.utc)
        o.createdAt = datetime(2025, 1, 1, tzinfo=timezone.utc)

        mock_account_repo.get_user_orders.return_value = [o]
        mock_account_repo.count_user_orders.return_value = 42

        hist = await account_service.get_order_history("buyer-1", skip=0, limit=10)
        assert hist.total == 42
        assert len(hist.orders) == 1
        assert hist.orders[0].item_title == "Book A"
        assert hist.orders[0].amount == 120.5
        mock_account_repo.get_user_orders.assert_awaited_with("buyer-1", 0, 10)

    async def test_missing_item_title_unknown(self, account_service, mock_account_repo, patch_get_redis):
        o = MagicMock()
        o.id = "o2"
        o.item = None
        o.amount = 0
        o.status = "pending"
        o.paidAt = None
        o.createdAt = datetime(2025, 1, 1, tzinfo=timezone.utc)
        mock_account_repo.get_user_orders.return_value = [o]
        mock_account_repo.count_user_orders.return_value = 1

        hist = await account_service.get_order_history("b")
        assert hist.orders[0].item_title == "Unknown"
