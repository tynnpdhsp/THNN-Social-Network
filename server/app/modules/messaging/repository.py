from typing import List, Optional
from datetime import datetime, timezone
from prisma import Prisma, Json
from prisma.models import Conversation, Message
from app.modules.messaging.schemas import ConversationMember, LastMessageEmbed

class MessagingRepository:
    def __init__(self, db: Prisma):
        self.db = db

    async def get_user_conversations(self, user_id: str, skip: int = 0, limit: int = 20) -> List[Conversation]:
        """Liệt kê danh sách hội thoại của người dùng (tối ưu bằng participantIds + fallback)."""
        try:
            # 1. Thử tìm bằng participantIds (nhanh)
            convs = await self.db.conversation.find_many(
                where={"participantIds": {"has": user_id}},
                order={"updatedAt": "desc"},
            )
            return convs[skip : skip + limit]
        except Exception:
            # 2. Nếu lỗi (do Prisma Client chưa cập nhật), dùng kiểu cũ
            all_convs = await self.db.conversation.find_many(order={"updatedAt": "desc"})
            user_convs = []
            for conv in all_convs:
                members = conv.members if isinstance(conv.members, list) else []
                if any((m.get("user_id") == user_id or m.get("userId") == user_id) for m in members):
                    user_convs.append(conv)
            return user_convs[skip : skip + limit]

    async def count_user_conversations(self, user_id: str) -> int:
        try:
            return await self.db.conversation.count(where={"participantIds": {"has": user_id}})
        except Exception:
            all_convs = await self.db.conversation.find_many()
            return len([c for c in all_convs if any((m.get("user_id") == user_id or m.get("userId") == user_id) for m in (c.members if isinstance(c.members, list) else []))])

    async def get_conversation_by_id(self, conv_id: str) -> Optional[Conversation]:
        return await self.db.conversation.find_unique(where={"id": conv_id})

    async def find_direct_conversation(self, user_a: str, user_b: str) -> Optional[Conversation]:
        """Tìm hội thoại loại 'direct' (trực tiếp) giữa đúng hai người dùng."""
        try:
            return await self.db.conversation.find_first(
                where={
                    "type": "direct",
                    "participantIds": {"has_every": [user_a, user_b]}
                }
            )
        except Exception:
            all_convs = await self.db.conversation.find_many(where={"type": "direct"})
            for c in all_convs:
                members = c.members if isinstance(c.members, list) else []
                m_ids = {m.get("user_id") or m.get("userId") for m in members}
                if user_a in m_ids and user_b in m_ids:
                    return c
            return None

    async def create_conversation(self, conv_type: str, members: List[dict], name: Optional[str] = None, participant_ids: List[str] = []) -> Conversation:
        try:
            return await self.db.conversation.create(
                data={
                    "type": conv_type,
                    "name": name,
                    "members": Json(members),
                    "participantIds": participant_ids,
                    "updatedAt": datetime.now(timezone.utc)
                }
            )
        except Exception:
            # Fallback nếu client chưa cập nhật participantIds
            return await self.db.conversation.create(
                data={
                    "type": conv_type,
                    "name": name,
                    "members": Json(members),
                    "updatedAt": datetime.now(timezone.utc)
                }
            )

    async def get_messages(self, conv_id: str, skip: int = 0, limit: int = 50) -> List[Message]:
        return await self.db.message.find_many(
            where={"conversationId": conv_id},
            order={"createdAt": "desc"},
            skip=skip,
            take=limit
        )

    async def count_messages(self, conv_id: str) -> int:
        return await self.db.message.count(where={"conversationId": conv_id})

    async def create_message(self, conv_id: str, sender_id: str, content: str, attachments: List[str] = []) -> Message:
        # 1. Tạo tin nhắn
        msg = await self.db.message.create(
            data={
                "conversationId": conv_id,
                "senderId": sender_id,
                "content": content,
                "attachments": attachments
            }
        )
        # 2. Cập nhật lastMessage và updatedAt của hội thoại
        last_msg_embed = {
            "content": content[:100], # Cắt ngắn để xem trước
            "sender_id": sender_id,
            "created_at": msg.createdAt.isoformat()
        }
        await self.db.conversation.update(
            where={"id": conv_id},
            data={
                "lastMessage": Json(last_msg_embed),
                "updatedAt": datetime.now(timezone.utc)
            }
        )
        return msg

    async def update_member_last_read(self, conversation_id: str, user_id: str):
        conv = await self.db.conversation.find_unique(where={"id": conversation_id})
        if not conv or not conv.members:
            return

        members = conv.members
        updated = False
        for m in members:
            # Check both cases just in case
            if m.get("user_id") == user_id or m.get("userId") == user_id:
                m["last_read_at"] = datetime.now(timezone.utc).isoformat()
                updated = True
        
        if updated:
            await self.db.conversation.update(
                where={"id": conversation_id},
                data={"members": Json(members)}
            )
