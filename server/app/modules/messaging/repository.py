from typing import List, Optional
from datetime import datetime, timezone
from prisma import Prisma, Json
from prisma.models import Conversation, Message
from app.modules.messaging.schemas import ConversationMember, LastMessageEmbed

class MessagingRepository:
    def __init__(self, db: Prisma):
        self.db = db

    async def get_user_conversations(self, user_id: str, skip: int = 0, limit: int = 20) -> List[Conversation]:
        """
        Liệt kê danh sách hội thoại của người dùng.
        Lưu ý: Việc lọc Json trên Prisma MongoDB bị hạn chế trong client Python.
        Tạm thời lọc bằng Python.
        """
        # Lấy tất cả (hoặc một nhóm đủ lớn) và lọc
        all_convs = await self.db.conversation.find_many(
            order={"updatedAt": "desc"}
        )
        
        user_convs = []
        for conv in all_convs:
            members = conv.members if isinstance(conv.members, list) else []
            # Check both cases for user_id/userId inside JSON
            if any((m.get("user_id") == user_id or m.get("userId") == user_id) for m in members):
                user_convs.append(conv)
        
        return user_convs[skip : skip + limit]

    async def count_user_conversations(self, user_id: str) -> int:
        all_convs = await self.db.conversation.find_many()
        filtered = [c for c in all_convs if any((m.get("user_id") == user_id or m.get("userId") == user_id) for m in (c.members if isinstance(c.members, list) else []))]
        return len(filtered)

    async def get_conversation_by_id(self, conv_id: str) -> Optional[Conversation]:
        return await self.db.conversation.find_unique(where={"id": conv_id})

    async def find_direct_conversation(self, user_a: str, user_b: str) -> Optional[Conversation]:
        """Tìm hội thoại loại 'direct' (trực tiếp) giữa đúng hai người dùng."""
        all_convs = await self.db.conversation.find_many(where={"type": "direct"})
        for c in all_convs:
            members = c.members if isinstance(c.members, list) else []
            member_ids = {m.get("user_id") for m in members}
            if len(member_ids) == 2 and user_a in member_ids and user_b in member_ids:
                return c
        return None

    async def create_conversation(self, conv_type: str, members: List[dict], name: Optional[str] = None) -> Conversation:
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
        async with self.db.tx() as tx:
            # 1. Tạo tin nhắn
            msg = await tx.message.create(
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
            await tx.conversation.update(
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
