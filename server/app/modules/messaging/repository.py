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
        List conversations for a user.
        Note: Prisma MongoDB Json filtering is limited in the Python client.
        We filter in Python for now.
        """
        # Fetch all (or a large enough batch) and filter
        all_convs = await self.db.conversation.find_many(
            order={"updatedAt": "desc"}
        )
        # Filter where user_id is in members list
        filtered = []
        for c in all_convs:
            members = c.members if isinstance(c.members, list) else []
            if any(m.get("user_id") == user_id for m in members):
                filtered.append(c)
        
        return filtered[skip : skip + limit]

    async def count_user_conversations(self, user_id: str) -> int:
        all_convs = await self.db.conversation.find_many()
        filtered = [c for c in all_convs if any(m.get("user_id") == user_id for m in (c.members if isinstance(c.members, list) else []))]
        return len(filtered)

    async def get_conversation_by_id(self, conv_id: str) -> Optional[Conversation]:
        return await self.db.conversation.find_unique(where={"id": conv_id})

    async def find_direct_conversation(self, user_a: str, user_b: str) -> Optional[Conversation]:
        """Find a 'direct' type conversation between exactly two users."""
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
            # 1. Create message
            msg = await tx.message.create(
                data={
                    "conversationId": conv_id,
                    "senderId": sender_id,
                    "content": content,
                    "attachments": attachments
                }
            )
            # 2. Update conversation lastMessage and updatedAt
            last_msg_embed = {
                "content": content[:100], # Truncate for preview
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
