"""``AdminService.get_stats_overview``."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.modules.admin.schemas import AdminStatsOverview


@pytest.mark.asyncio
class TestGetStatsOverview:
    async def test_maps_repo_dict_to_overview(self, admin_service, mock_admin_repo):
        mock_admin_repo.get_overview_stats = AsyncMock(
            return_value={
                "total_users": 10,
                "total_posts": 20,
                "pending_reports": 3,
                "active_users_24h": 4,
                "total_revenue": 99.5,
                "total_banned_users": 1,
            }
        )

        out = await admin_service.get_stats_overview()

        assert isinstance(out, AdminStatsOverview)
        assert out.total_users == 10
        assert out.total_posts == 20
        assert out.pending_reports == 3
        assert out.active_users_24h == 4
        assert out.total_revenue == 99.5
        assert out.total_banned_users == 1
        mock_admin_repo.get_overview_stats.assert_awaited_once()
