import json
from datetime import datetime, timezone
from typing import List, Optional

from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
from app.core.redis import get_redis
from app.modules.messaging.repository import MessagingRepository
from app.modules.messaging.schemas import (
    ConversationResponse, MessageResponse, SendMessageRequest,
    CreateConversationRequest, PaginatedConversationResponse,
    PaginatedMessageResponse, ConversationMember, LastMessageEmbed
)
from app.modules.messaging.ws_manager import manager
from app.modules.social.schemas import UserInfoEmbed
from app.modules.notification.service import NotificationService

class MessagingService:
    def __init__(self, repo: MessagingRepository, notification_svc: NotificationService = None):
        self.repo = repo
        self.notification_svc = notification_svc

    async def get_conversations(self, user_id: str, skip: int = 0, limit: int = 20) -> PaginatedConversationResponse:
        convs = await self.repo.get_user_conversations(user_id, skip, limit)
        total = await self.repo.count_user_conversations(user_id)
        
        items = []
        for c in convs:
            items.append(await self._map_conv_to_response(c, user_id))
            
        return PaginatedConversationResponse(conversations=items, total=total, skip=skip, limit=limit)

    async def get_messages(self, user_id: str, conv_id: str, skip: int = 0, limit: int = 50) -> PaginatedMessageResponse:
        conv = await self.repo.get_conversation_by_id(conv_id)
        if not conv:
            raise NotFoundException("Không tìm thấy hội thoại", "CONVERSATION_NOT_FOUND")
        
        # Check if user is member
        members = conv.members if isinstance(conv.members, list) else []
        if not any(m.get("user_id") == user_id for m in members):
            raise ForbiddenException("Bạn không có quyền truy cập hội thoại này", "NOT_A_MEMBER")
            
        messages = await self.repo.get_messages(conv_id, skip, limit)
        total = await self.repo.count_messages(conv_id)
        
        items = [
            MessageResponse(
                id=m.id,
                conversation_id=m.conversationId,
                sender_id=m.senderId,
                content=m.content,
                attachments=m.attachments or [],
                created_at=m.createdAt
            )
            for m in messages
        ]
        return PaginatedMessageResponse(messages=items, total=total, skip=skip, limit=limit)

    async def create_conversation(self, user_id: str, body: CreateConversationRequest) -> ConversationResponse:
        if body.type == "direct":
            if not body.participant_ids:
                raise BadRequestException("Cần có người nhận", "MISSING_PARTICIPANT")
            other_user_id = body.participant_ids[0]
            
            # Block Check
            block_exists = await self.repo.db.userblock.find_first(
                where={
                    "OR": [
                        {"blockerId": user_id, "blockedId": other_user_id},
                        {"blockerId": other_user_id, "blockedId": user_id}
                    ]
                }
            )
            if block_exists:
                raise ForbiddenException("Không thể gửi tin nhắn (Người dùng đã bị chặn hoặc bạn bị chặn)", "USER_BLOCKED")

            # Privacy Check
            from app.modules.account.repository import AccountRepository
            from app.modules.social.repository import SocialRepository
            
            acc_repo = AccountRepository(self.repo.db)
            privacy = await acc_repo.get_privacy_settings(other_user_id)
            if privacy:
                if privacy.whoCanMessage == "only_me":
                    raise ForbiddenException("Người dùng này không nhận tin nhắn từ bất kỳ ai", "MESSAGING_DISABLED")
                if privacy.whoCanMessage == "friends":
                    # Check if they are friends
                    soc_repo = SocialRepository(self.repo.db)
                    friend_ids = await soc_repo.get_friend_ids(other_user_id)
                    if user_id not in friend_ids:
                        raise ForbiddenException("Người dùng này chỉ nhận tin nhắn từ bạn bè", "FRIENDS_ONLY_MESSAGE")
            
            # Check for existing DM
            existing = await self.repo.find_direct_conversation(user_id, other_user_id)
            if existing:
                return await self._map_conv_to_response(existing, user_id)
            
            members = [
                {"user_id": user_id, "role": "member"},
                {"user_id": other_user_id, "role": "member"}
            ]
            conv = await self.repo.create_conversation("direct", members, participant_ids=[user_id, other_user_id])
            return await self._map_conv_to_response(conv, user_id)
        else:
            # Group chat
            participant_ids = [user_id] + body.participant_ids
            members = [{"user_id": user_id, "role": "admin"}]
            for pid in body.participant_ids:
                members.append({"user_id": pid, "role": "member"})
            
            conv = await self.repo.create_conversation("group", members, body.name, participant_ids=participant_ids)
            return await self._map_conv_to_response(conv, user_id)

    async def send_message(self, user_id: str, conv_id: str, body: SendMessageRequest) -> MessageResponse:
        conv = await self.repo.get_conversation_by_id(conv_id)
        if not conv:
            raise NotFoundException("Không tìm thấy hội thoại", "CONVERSATION_NOT_FOUND")
        
        # Sử dụng getattr để tránh lỗi nếu Prisma Client chưa cập nhật
        member_ids = getattr(conv, 'participantIds', None)
        if member_ids is None:
            # Fallback về cách cũ (lấy từ JSON members)
            members = conv.members if isinstance(conv.members, list) else []
            member_ids = [m.get("user_id") or m.get("userId") for m in members if (m.get("user_id") or m.get("userId"))]
            
        if user_id not in member_ids:
            raise ForbiddenException("Bạn không có quyền gửi tin nhắn vào đây", "NOT_A_MEMBER")
            
        msg = await self.repo.create_message(conv_id, user_id, body.content, body.attachments)
        
        res = MessageResponse(
            id=msg.id,
            conversation_id=msg.conversationId,
            sender_id=msg.senderId,
            content=msg.content,
            attachments=msg.attachments or [],
            created_at=msg.createdAt
        )
        
        # Real-time delivery (chỉ gửi cho người khác, người gửi đã nhận qua REST)
        redis = await get_redis()
        payload = {
            "type": "new_message",
            "data": res.model_dump(mode='json')
        }
        other_member_ids = [mid for mid in member_ids if mid != user_id]
        await redis.publish("chat_updates", json.dumps({
            "target_user_ids": other_member_ids,
            "payload": payload
        }))
        
        # Không tạo notification DB cho tin nhắn nữa
        # (Tin nhắn chưa đọc sẽ hiển thị bằng dấu chấm đỏ trên tab Tin nhắn)

        return res

    async def has_unread_messages(self, user_id: str) -> dict:
        """Kiểm tra xem user có tin nhắn chưa đọc không (cho dấu chấm đỏ trên Navbar)."""
        convs = await self.repo.get_user_conversations(user_id, skip=0, limit=50)
        for c in convs:
            members = c.members if isinstance(c.members, list) else []
            member = next((m for m in members if (m.get("user_id") or m.get("userId")) == user_id), None)
            if not member:
                continue
            last_read = member.get("last_read_at") or member.get("lastReadAt")
            last_msg = c.lastMessage
            if last_msg:
                msg_time = last_msg.get("created_at") or last_msg.get("createdAt")
                if msg_time and (not last_read or msg_time > last_read):
                    return {"has_unread": True}
        return {"has_unread": False}

    async def mark_conversation_as_read(self, user_id: str, conv_id: str):
        conv = await self.repo.get_conversation_by_id(conv_id)
        if not conv:
            raise NotFoundException("Không tìm thấy hội thoại", "CONVERSATION_NOT_FOUND")
            
        member_ids = getattr(conv, 'participantIds', None)
        if member_ids is None:
            members = conv.members if isinstance(conv.members, list) else []
            member_ids = [m.get("user_id") or m.get("userId") for m in members if (m.get("user_id") or m.get("userId"))]
            
        if user_id not in member_ids:
            raise ForbiddenException("Bạn không phải thành viên hội thoại này", "NOT_A_MEMBER")
            
        await self.repo.update_member_last_read(conv_id, user_id)
        return {"status": "success"}

    async def _map_conv_to_response(self, conv, viewer_id: str) -> ConversationResponse:
        # Map manually to be safe with Prisma MongoDB Json fields
        last_msg = None
        if conv.lastMessage:
            lm = conv.lastMessage
            # Handle both dict and Prisma model if applicable
            last_msg = LastMessageEmbed(
                content=lm.get("content", ""),
                sender_id=lm.get("sender_id") or lm.get("senderId", ""),
                created_at=lm.get("created_at") or lm.get("createdAt") or datetime.now(timezone.utc)
            )

        members = []
        raw_members = conv.members if isinstance(conv.members, list) else []
        for m in raw_members:
            members.append(ConversationMember(
                user_id=m.get("user_id") or m.get("userId"),
                role=m.get("role", "member"),
                last_read_at=m.get("last_read_at") or m.get("lastReadAt")
            ))

        res = ConversationResponse(
            id=conv.id,
            type=conv.type,
            name=conv.name,
            members=members,
            last_message=last_msg,
            updated_at=conv.updatedAt
        )
        
        if conv.type == "direct":
            # Populate other_member info
            other_id = next((m.user_id for m in members if m.user_id != viewer_id), None)
            if other_id:
                res.other_member = await self._get_user_embed(other_id)
                if not res.name:
                    res.name = res.other_member.full_name
        
        return res

    async def _get_user_embed(self, user_id: str) -> UserInfoEmbed:
        from app.core.dependencies import get_account_repo
        from app.core.dependencies import db as prisma_db
        user_repo = get_account_repo(prisma_db)
        user = await user_repo.get_user_by_id(user_id)
        if user:
            return UserInfoEmbed(id=user.id, full_name=user.fullName, avatar_url=user.avatarUrl)
        return UserInfoEmbed(id=user_id, full_name="Người dùng")

    async def _get_user_name(self, user_id: str) -> str:
        embed = await self._get_user_embed(user_id)
        return embed.full_name
