"""``AdminService.get_audit_logs``."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from .conftest import make_audit_row


@pytest.mark.asyncio
class TestGetAuditLogs:
    async def test_maps_logs_and_total(self, admin_service, mock_admin_repo):
        logs = [make_audit_row("l1"), make_audit_row("l2", user_id=None)]
        mock_admin_repo.get_audit_logs = AsyncMock(return_value=logs)
        mock_admin_repo.count_audit_logs = AsyncMock(return_value=100)

        out = await admin_service.get_audit_logs(skip=2, limit=15)

        mock_admin_repo.get_audit_logs.assert_awaited_once_with(2, 15)
        mock_admin_repo.count_audit_logs.assert_awaited_once()
        assert out.total == 100
        assert out.skip == 2
        assert out.limit == 15
        assert len(out.logs) == 2
        assert out.logs[0].id == "l1"
        assert out.logs[0].user_id == "u-x"
        assert out.logs[0].action == "LOGIN"
        assert out.logs[0].payload == {"ip": "127.0.0.1"}
        assert out.logs[1].user_id is None
