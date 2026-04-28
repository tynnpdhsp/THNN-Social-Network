from typing import Optional
from fastapi import APIRouter, Depends, Query, Request

from app.core.dependencies import get_admin_service, require_admin
from app.modules.admin.service import AdminService
from app.modules.admin.schemas import (
    AdminStatsOverview, PaginatedAdminUserResponse, AdminUserResponse,
    LockAccountRequest, PaginatedReportResponse, AdminReportResponse,
    ResolveReportRequest, PaginatedAuditLogResponse, UpdateUserRoleRequest
)

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])

@router.get("/stats/overview", response_model=AdminStatsOverview)
async def get_stats_overview(
    admin_id: str = Depends(require_admin),
    svc: AdminService = Depends(get_admin_service),
):
    """Lấy tổng quan thông số hệ thống."""
    return await svc.get_stats_overview()

# --- User Management ---

@router.get("/users", response_model=PaginatedAdminUserResponse)
async def get_admin_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    is_locked: Optional[bool] = Query(None),
    admin_id: str = Depends(require_admin),
    svc: AdminService = Depends(get_admin_service),
):
    """Danh sách người dùng (Admin only)."""
    return await svc.get_users(skip, limit, is_locked)

@router.post("/users/{user_id}/lock", response_model=AdminUserResponse)
async def lock_user(
    user_id: str,
    body: LockAccountRequest,
    admin_id: str = Depends(require_admin),
    svc: AdminService = Depends(get_admin_service),
):
    """Khóa tài khoản người dùng."""
    return await svc.lock_user(user_id, admin_id, body.reason)

@router.post("/users/{user_id}/unlock", response_model=AdminUserResponse)
async def unlock_user(
    user_id: str,
    admin_id: str = Depends(require_admin),
    svc: AdminService = Depends(get_admin_service),
):
    """Mở khóa tài khoản người dùng."""
    return await svc.unlock_user(user_id)

@router.patch("/users/{user_id}/role", response_model=AdminUserResponse)
async def update_user_role(
    user_id: str,
    body: UpdateUserRoleRequest,
    admin_id: str = Depends(require_admin),
    svc: AdminService = Depends(get_admin_service),
):
    """Gán vai trò cho người dùng (UC-28)."""
    return await svc.update_user_role(user_id, body.role)

# --- Report Management ---

@router.get("/reports", response_model=PaginatedReportResponse)
async def get_admin_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="pending | resolved | dismissed"),
    admin_id: str = Depends(require_admin),
    svc: AdminService = Depends(get_admin_service),
):
    """Danh sách báo cáo vi phạm."""
    return await svc.get_reports(skip, limit, status)

@router.post("/reports/{report_id}/resolve", response_model=AdminReportResponse)
async def resolve_report(
    report_id: str,
    body: ResolveReportRequest,
    admin_id: str = Depends(require_admin),
    svc: AdminService = Depends(get_admin_service),
):
    """Xử lý báo cáo vi phạm."""
    return await svc.resolve_report(report_id, admin_id, body.action)

# --- Audit Logs ---

@router.get("/audit-logs", response_model=PaginatedAuditLogResponse)
async def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    admin_id: str = Depends(require_admin),
    svc: AdminService = Depends(get_admin_service),
):
    """Nhật ký hoạt động hệ thống."""
    return await svc.get_audit_logs(skip, limit)
