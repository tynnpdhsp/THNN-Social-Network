from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.modules.social.schemas import UserInfoEmbed

# --- Embedded Types ---

class ConversationMember(BaseModel):
    user_id: str
    role: str = "member"  # 'member' | 'admin'
    last_read_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class LastMessageEmbed(BaseModel):
    content: str
    sender_id: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Messages ---

class MessageResponse(BaseModel):
    id: str
    conversation_id: str = Field(alias="conversationId")
    sender_id: str = Field(alias="senderId")
    content: str
    attachments: List[str] = []
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class SendMessageRequest(BaseModel):
    content: str
    attachments: List[str] = []

# --- Conversations ---

class CreateConversationRequest(BaseModel):
    type: str = "direct"  # 'direct' | 'group'
    name: Optional[str] = None
    participant_ids: List[str]  # For DM, just one other ID. For group, list of IDs.

class ConversationResponse(BaseModel):
    id: str
    type: str
    name: Optional[str] = None
    members: List[ConversationMember] = []
    last_message: Optional[LastMessageEmbed] = Field(default=None, alias="lastMessage")
    updated_at: datetime = Field(alias="updatedAt")
    
    # Virtual fields for UI convenience
    other_member: Optional[UserInfoEmbed] = None  # Populated for 'direct' chats

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class PaginatedConversationResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int
    skip: int
    limit: int

class PaginatedMessageResponse(BaseModel):
    messages: List[MessageResponse]
    total: int
    skip: int
    limit: int
