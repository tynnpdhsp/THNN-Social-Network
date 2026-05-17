from typing import List, Optional
from fastapi import HTTPException
from prisma.models import User, Post, Report, AuditLog

from app.modules.admin.repository import AdminRepository
from app.modules.admin.schemas import (
    AdminStatsOverview, AdminUserResponse, PaginatedAdminUserResponse,
    AdminReportResponse, PaginatedReportResponse,
    AuditLogResponse, PaginatedAuditLogResponse,
    UpdateUserRoleRequest
)
from app.modules.messaging.ws_manager import notify_user_locked

class AdminService:
    def __init__(self, repo: AdminRepository):
        self.repo = repo

    async def get_stats_overview(self) -> AdminStatsOverview:
        stats = await self.repo.get_overview_stats()
        # Repository đã trả về các key dạng snake_case
        return AdminStatsOverview(**stats)

    async def get_users(self, skip: int, limit: int, is_locked: Optional[bool] = None) -> PaginatedAdminUserResponse:
        users = await self.repo.get_users(skip, limit, is_locked)
        total = await self.repo.count_users(is_locked)
        
        user_list = [
            AdminUserResponse(
                id=u.id,
                email=u.email,
                full_name=u.fullName,
                role=u.roleRef.role if u.roleRef else "unknown",
                is_locked=u.isLocked,
                created_at=u.createdAt,
                avatar_url=u.avatarUrl if u.avatarUrl else None,
                last_login_at=u.lastLoginAt
            ) for u in users
        ]
        
        return PaginatedAdminUserResponse(
            users=user_list,
            total=total,
            skip=skip,
            limit=limit
        )

    async def lock_user(self, user_id: str, admin_id: str, reason: str, request_info: dict = None) -> AdminUserResponse:
        user = await self.repo.lock_user(user_id, admin_id, reason)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Push notification to kick user immediately
        await notify_user_locked(user_id)
        
        # Audit Log
        if request_info:
            await self.repo.create_audit_log(
                user_id=admin_id,
                action="Khóa tài khoản",
                severity="warning",
                request_info=request_info,
                payload={
                    "target_user_id": user_id, 
                    "target_name": user.fullName,
                    "reason": reason
                }
            )
        
        # Reload to get role info
        user = await self.repo.db.user.find_unique(where={"id": user_id}, include={"roleRef": True})
            
        return AdminUserResponse(
            id=user.id,
            email=user.email,
            full_name=user.fullName,
            role=user.roleRef.role if user.roleRef else "student",
            is_locked=user.isLocked,
            created_at=user.createdAt,
            last_login_at=user.lastLoginAt
        )

    async def unlock_user(self, user_id: str, admin_id: str = None, request_info: dict = None) -> AdminUserResponse:
        user = await self.repo.unlock_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Audit Log
        if request_info:
            await self.repo.create_audit_log(
                user_id=admin_id,
                action="Mở khóa tài khoản",
                severity="info",
                request_info=request_info,
                payload={
                    "target_user_id": user_id,
                    "target_name": user.fullName
                }
            )

        # Reload to get role info
        user = await self.repo.db.user.find_unique(where={"id": user_id}, include={"roleRef": True})
            
        return AdminUserResponse(
            id=user.id,
            email=user.email,
            full_name=user.fullName,
            role=user.roleRef.role if user.roleRef else "student",
            is_locked=user.isLocked,
            created_at=user.createdAt,
            last_login_at=user.lastLoginAt
        )

    async def get_reports(self, skip: int, limit: int, status: Optional[str] = None) -> PaginatedReportResponse:
        results, total = await self.repo.get_reports(skip, limit, status)
        
        report_list = [
            AdminReportResponse(**r) for r in results
        ]
        
        return PaginatedReportResponse(
            reports=report_list,
            total=total,
            skip=skip,
            limit=limit
        )

    async def resolve_report(self, report_id: str, admin_id: str, action: str, request_info: dict = None) -> AdminReportResponse:
        report = await self.repo.db.report.find_unique(where={"id": report_id}, include={"reporter": True})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
            
        resolved = await self.repo.resolve_report(report_id, admin_id, action)
        
        # Audit Log
        if request_info:
            target_obj_name = "N/A"
            if resolved.targetType == "user":
                u = await self.repo.db.user.find_unique(where={"id": resolved.targetId})
                if u: target_obj_name = u.fullName
            elif resolved.targetType == "post":
                p = await self.repo.db.post.find_unique(where={"id": resolved.targetId})
                if p: target_obj_name = p.content[:30] + "..."
            
            await self.repo.create_audit_log(
                user_id=admin_id,
                action="Xử lý báo cáo",
                severity="info" if action == "dismiss" else "warning",
                request_info=request_info,
                payload={
                    "report_id": report_id, 
                    "action": action, 
                    "target_id": resolved.targetId,
                    "target_name": target_obj_name
                }
            )

        # Execute side effects
        target_name = f"{resolved.targetType} ID: {resolved.targetId}"
        if action == "hide_content":
            if resolved.targetType == "post":
                await self.repo.hide_post(resolved.targetId)
                target_name = "Bài viết (Đã ẩn)"
            elif resolved.targetType == "comment":
                await self.repo.hide_comment(resolved.targetId)
                target_name = "Bình luận (Đã ẩn)"
        
        elif action == "lock_account":
            user_to_lock = None
            if resolved.targetType == "user":
                user_to_lock = resolved.targetId
            elif resolved.targetType == "post":
                p = await self.repo.db.post.find_unique(where={"id": resolved.targetId})
                if p: user_to_lock = p.userId
            
            if user_to_lock:
                await self.repo.lock_user(user_to_lock, admin_id, f"Vi phạm từ báo cáo {report_id}")
                await notify_user_locked(user_to_lock)
                target_name = "Tài khoản (Đã khóa)"
        
        return AdminReportResponse(
            id=resolved.id,
            reporter_id=resolved.reporterId,
            reporter_name=report.reporter.fullName if report.reporter else "Unknown",
            target_type=resolved.targetType,
            target_id=resolved.targetId,
            target_name=target_name,
            reason=resolved.reason,
            description=resolved.description,
            status=resolved.status,
            created_at=resolved.createdAt,
            resolved_at=resolved.resolvedAt,
            resolved_by=resolved.resolvedBy,
            resolved_action=resolved.resolvedAction
        )

    async def update_user_role(self, user_id: str, new_role_name: str, admin_id: str = None, request_info: dict = None) -> AdminUserResponse:
        if admin_id and user_id == admin_id:
            raise HTTPException(status_code=400, detail="Bạn không thể tự hạ vai trò của chính mình!")

        role = await self.repo.db.role.find_first(where={"role": new_role_name})
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
            
        user = await self.repo.update_user_role(user_id, role.id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Tải lại dữ liệu kèm roleRef
        updated = await self.repo.db.user.find_unique(where={"id": user_id}, include={"roleRef": True})
        if not updated:
            raise HTTPException(status_code=404, detail="User not found")

        # Audit Log
        if request_info:
            await self.repo.create_audit_log(
                user_id=admin_id,
                action="Cập nhật vai trò",
                severity="info",
                request_info=request_info,
                payload={
                    "target_user_id": user_id, 
                    "target_name": updated.fullName,
                    "new_role": new_role_name
                }
            )
            
        return AdminUserResponse(
            id=updated.id,
            email=updated.email,
            full_name=updated.fullName,
            role=updated.roleRef.role if updated.roleRef else "unknown",
            is_locked=updated.isLocked,
            created_at=updated.createdAt,
            last_login_at=updated.lastLoginAt
        )

    async def get_audit_logs(self, skip: int, limit: int) -> PaginatedAuditLogResponse:
        logs = await self.repo.get_audit_logs(skip, limit)
        total = await self.repo.count_audit_logs()
        
        # Lấy danh sách admin_id duy nhất để fetch tên
        admin_ids = list(set(l.userId for l in logs if l.userId))
        admin_map = {}
        if admin_ids:
            admins = await self.repo.db.user.find_many(
                where={"id": {"in": admin_ids}}
            )
            admin_map = {u.id: u.fullName for u in admins}

        log_list = [
            AuditLogResponse(
                id=l.id,
                user_id=l.userId,
                admin_name=admin_map.get(l.userId, "Hệ thống"),
                action=l.action,
                severity=l.severity,
                created_at=l.createdAt,
                payload=l.payload
            ) for l in logs
        ]
        
        return PaginatedAuditLogResponse(
            logs=log_list,
            total=total,
            skip=skip,
            limit=limit
        )
