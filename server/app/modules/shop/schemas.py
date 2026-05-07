from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field # type: ignore

# --- Category Schemas ---

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

class CategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    createdAt: datetime

    class Config:
        from_attributes = True

# ─── Item Schemas ───────────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    category_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=2000)
    price: float = Field(..., gt=0)

class ItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1, max_length=2000)
    price: Optional[float] = Field(None, gt=0)
    status: Optional[str] = Field(None, pattern="^(active|sold|hidden)$")

class ItemResponse(BaseModel):
    id: str
    seller_id: str
    category_id: str
    title: str
    description: str
    price: float
    avg_rating: float
    rating_count: int
    status: str
    created_at: datetime
    updated_at: datetime
    
    # Relations
    category: Optional[CategoryResponse] = None
    images: List["ItemResponse"] = []

    class Config:
        from_attributes = True

class ItemListResponse(BaseModel):
    items: List[ItemResponse]
    total: int
    skip: int
    limit: int

# ─── Image Schemas ─────────────────────────────────────────────────────────

class ImageCreate(BaseModel):
    image_url: str
    display_order: Optional[int] = 0

class ImageResponse(BaseModel):
    id: str
    item_id: str
    image_url: str
    display_order: int
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Order Schemas ─────────────────────────────────────────────────────────

class OrderCreate(BaseModel):
    item_id: str
    payment_method: str = Field(default="vnpay", pattern="^(vnpay)$")

class OrderResponse(BaseModel):
    id: str
    buyer_id: str
    item_id: str
    seller_id: str
    amount: float
    status: str
    payment_method: str
    vnpay_txn_ref: Optional[str]
    vnpay_response_code: Optional[str]
    paid_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    # Relations
    item: Optional[ItemResponse] = None

    class Config:
        from_attributes = True

class OrderListResponse(BaseModel):
    orders: List[OrderResponse]
    total: int
    skip: int
    limit: int

# ─── Payment Schemas ───────────────────────────────────────────────────────

class VNPayCreatePaymentRequest(BaseModel):
    order_id: str
    amount: float
    return_url: str

class VNPayPaymentResponse(BaseModel):
    payment_url: str
    txn_ref: str

class VNPayCallbackRequest(BaseModel):
    vnp_TxnRef: str
    vnp_ResponseCode: str
    vnp_TransactionStatus: str

# ─── Common Schemas ─────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str

class PaginatedParams(BaseModel):
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)

# Forward references
ItemResponse.model_rebuild()