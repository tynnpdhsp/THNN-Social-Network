from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field

# --- Thống kê ---
class AdminStatsOverview(BaseModel):
    total_users: int
    total_posts: int
    pending_reports: int
    active_users_24h: int
    total_revenue: float
    total_banned_users: int

# --- Quản lý người dùng ---
class AdminUserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_locked: bool
    avatar_url: Optional[str] = None
    created_at: datetime
    last_login_at: Optional[datetime] = None

class PaginatedAdminUserResponse(BaseModel):
    users: List[AdminUserResponse]
    total: int
    skip: int
    limit: int

class LockAccountRequest(BaseModel):
    reason: str

class UpdateUserRoleRequest(BaseModel):
    role: str # 'student' | 'admin'

# --- Quản lý báo cáo ---
class AdminReportResponse(BaseModel):
    id: str
    reporter_id: str
    reporter_name: str
    target_type: str # 'post' | 'comment' | 'user'
    target_id: str
    target_name: Optional[str] = None
    target_preview: Optional[str] = None
    reason: str
    description: Optional[str] = None
    status: str # 'pending' | 'resolved' | 'dismissed'
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolved_action: Optional[str] = None

class PaginatedReportResponse(BaseModel):
    reports: List[AdminReportResponse]
    total: int
    skip: int
    limit: int

class ResolveReportRequest(BaseModel):
    action: str # 'hide_content' | 'lock_account' | 'dismiss'
    note: Optional[str] = None

# --- Nhật ký hệ thống ---
class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    admin_name: Optional[str] = "Hệ thống"
    action: str
    severity: str
    created_at: datetime
    payload: Optional[Any] = None

class PaginatedAuditLogResponse(BaseModel):
    logs: List[AuditLogResponse]
    total: int
    skip: int
    limit: int
