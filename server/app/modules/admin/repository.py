from datetime import datetime, timedelta, timezone
from typing import List, Optional
from prisma import Prisma
from prisma.models import User, Post, Report, AuditLog
import logging

logger = logging.getLogger(__name__)

class AdminRepository:
    def __init__(self, db: Prisma):
        self.db = db

    # --- Statistics ---
    async def get_overview_stats(self) -> dict:
        total_users = await self.db.user.count()
        total_posts = await self.db.post.count()
        pending_reports = await self.db.report.count(where={"status": "pending"})
        
        # Active users in last 24h
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        active_users = await self.db.user.count(where={"lastLoginAt": {"gte": yesterday}})
        
        # Total Revenue from paid orders
        revenue_data = await self.db.order.group_by(
            by=["status"],
            sum={"amount": True},
            where={"status": "paid"}
        )
        total_revenue = revenue_data[0]["_sum"]["amount"] if revenue_data else 0.0

        total_banned_users = await self.db.user.count(where={"isLocked": True})

        return {
            "total_users": total_users,
            "total_posts": total_posts,
            "pending_reports": pending_reports,
            "active_users_24h": active_users,
            "total_revenue": total_revenue,
            "total_banned_users": total_banned_users
        }

    # --- User Management ---
    async def get_users(self, skip: int, limit: int, is_locked: Optional[bool] = None) -> List[User]:
        where = {}
        if is_locked is not None:
            where["isLocked"] = is_locked
            
        return await self.db.user.find_many(
            where=where,
            include={"roleRef": True},
            skip=skip,
            take=limit,
            order={"createdAt": "desc"}
        )

    async def count_users(self, is_locked: Optional[bool] = None) -> int:
        where = {}
        if is_locked is not None:
            where["isLocked"] = is_locked
        return await self.db.user.count(where=where)

    async def lock_user(self, user_id: str, admin_id: str, reason: str) -> Optional[User]:
        return await self.db.user.update(
            where={"id": user_id},
            data={
                "isLocked": True,
                "lockReason": reason,
                "lockedAt": datetime.now(timezone.utc),
                "lockedBy": admin_id
            }
        )

    async def unlock_user(self, user_id: str) -> Optional[User]:
        return await self.db.user.update(
            where={"id": user_id},
            data={
                "isLocked": False,
                "lockReason": None,
                "lockedAt": None,
                "lockedBy": None
            }
        )

    async def update_user_role(self, user_id: str, role_id: str) -> User:
        return await self.db.user.update(
            where={"id": user_id},
            data={"roleId": role_id}
        )

    # --- Report Management ---
    async def get_reports(self, skip: int = 0, limit: int = 20, status: str = None):
        where = {}
        if status:
            where["status"] = status
        
        reports = await self.db.report.find_many(
            where=where,
            skip=skip,
            take=limit,
            order={"createdAt": "desc"},
            include={"reporter": True}
        )
        total = await self.db.report.count(where=where)
        
        results = []
        for r in reports:
            preview = "No preview available"
            target_name = "Unknown Target"
            try:
                if r.targetType == "post":
                    p = await self.db.post.find_unique(where={"id": r.targetId}, include={"user": True})
                    if p: 
                        preview = p.content[:500] + "..." if len(p.content) > 500 else p.content
                        target_name = f"Bài viết của {p.user.fullName}"
                elif r.targetType == "user":
                    u = await self.db.user.find_unique(where={"id": r.targetId})
                    if u: 
                        preview = f"Email: {u.email}"
                        target_name = f"Tài khoản {u.fullName}"
                elif r.targetType == "comment":
                    preview = f"Comment ID: {r.targetId}"
                    target_name = "Một bình luận"
            except Exception:
                pass

            results.append({
                "id": r.id,
                "reporter_id": r.reporterId,
                "reporter_name": r.reporter.fullName if r.reporter else "Unknown",
                "target_type": r.targetType,
                "target_id": r.targetId,
                "target_name": target_name,
                "target_preview": preview,
                "reason": r.reason,
                "description": r.description,
                "status": r.status,
                "created_at": r.createdAt
            })
            
        return results, total

    async def count_reports(self, status: Optional[str] = None) -> int:
        where = {}
        if status:
            where["status"] = status
        return await self.db.report.count(where=where)

    async def get_report_by_id(self, report_id: str) -> Optional[Report]:
        return await self.db.report.find_unique(where={"id": report_id})

    async def resolve_report(self, report_id: str, admin_id: str, action: str) -> Optional[Report]:
        # Clean ID just in case
        rid = report_id.strip()
        status = "resolved" if action != "dismiss" else "dismissed"
        
        # Perform update
        updated = await self.db.report.update(
            where={"id": rid},
            data={
                "status": status,
                "resolvedBy": admin_id,
                "resolvedAction": action,
                "resolvedAt": datetime.now(timezone.utc)
            }
        )
        return updated

    async def hide_post(self, post_id: str) -> bool:
        pid = post_id.strip()
        await self.db.post.update(where={"id": pid}, data={"isHidden": True})
        return True

    async def hide_comment(self, comment_id: str) -> bool:
        await self.db.comment.update(where={"id": comment_id}, data={"isHidden": True})
        return True

    # --- Audit Logs ---
    async def create_audit_log(self, user_id: Optional[str], action: str, severity: str, request_info: dict, payload: Optional[dict] = None):
        try:
            await self.db.auditlog.create(
                data={
                    "userId": user_id,
                    "action": action,
                    "severity": severity,
                    "request_info": request_info, # Changed from requestInfo
                    "payload": payload
                }
            )
        except Exception as e:
            logger.error(f"FAILED TO WRITE AUDIT LOG: {e}")
            # Don't crash the whole request just because logging failed

    async def get_audit_logs(self, skip: int, limit: int) -> List[AuditLog]:
        return await self.db.auditlog.find_many(
            skip=skip,
            take=limit,
            order={"createdAt": "desc"}
        )

    async def count_audit_logs(self) -> int:
        return await self.db.auditlog.count()
