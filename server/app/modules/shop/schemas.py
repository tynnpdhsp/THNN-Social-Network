from datetime import datetime
from typing import Optional, List, Dict, Literal
from pydantic import BaseModel, Field, ConfigDict # type: ignore

# ---- UserInfoEmbed --------
class UserInfoEmbed(BaseModel):
    id: str
    full_name: str
    avatar_url: Optional[str] = None

# region ---- Category ----
class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

    model_config = ConfigDict(from_attributes=True)

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

    model_config = ConfigDict(from_attributes=True)

class CategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
#endregion

# region ---- Items ----
class ItemCreate(BaseModel):
    category_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=2000)
    price: float = Field(..., gt=0)
    image_urls: List[str] = Field(default_factory=List, description="List of image URLs")

    model_config = ConfigDict(from_attributes=True)

class ItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1, max_length=2000)
    price: Optional[float] = Field(None, gt=0)
    status: Optional[str] = Field(None, pattern="^(active|sold|hidden)$")

    model_config = ConfigDict(from_attributes=True)

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
    images: Optional[List["ImageResponse"]] = None
    user_info: Optional[UserInfoEmbed] = None
    seller_info: Optional[Dict] = None

    model_config = ConfigDict(from_attributes=True)

class ItemListQuery(BaseModel):
    skip: int = Field(0, ge=0, description="Number of items to skip")
    limit: int = Field(20, ge=1, le=100, description="Number of items to return")
    sort: Literal["rating", "popular", "newest", "oldest", "price_low", "price_high"] = Field("newest", description="Sort order")
    category_id: Optional[str] = Field(None, description="Filter by category")
    search: Optional[str] = Field(None, description="Search in title and description")

    model_config = ConfigDict(from_attributes=True)

class ItemPaginationRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(20, le=100)

    model_config = ConfigDict(from_attributes=True)

class ItemListResponse(BaseModel):
    items: List[ItemResponse]
    total: int
    skip: int
    limit: int

    model_config = ConfigDict(from_attributes=True)
#endregion

# region ---- Image ----
class ImageCreate(BaseModel):
    image_url: str
    display_order: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)

class ImageResponse(BaseModel):
    image_url: str
    display_order: int

    model_config = ConfigDict(from_attributes=True)
#endregion

# region ---- Order ----
class OrderCreate(BaseModel):
    item_id: str
    payment_method: str = Field(default="vnpay", pattern="^(vnpay)$")
    amount: int = Field(default=1, ge=1)

    model_config = ConfigDict(from_attributes=True)

class OrderResponse(BaseModel):
    id: str
    buyer_id: str
    item_id: str
    seller_id: Optional[str] = None
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

    model_config = ConfigDict(from_attributes=True)

class OrderListResponse(BaseModel):
    orders: List[OrderResponse]
    total: int
    skip: int
    limit: int

    model_config = ConfigDict(from_attributes=True)
#endregion

# region ---- Payment ----
class VNPayCreatePaymentRequest(BaseModel):
    order_id: str
    ip_addr: str
    order_type: str = Field(default="other", pattern="^(other|billpayment|wallet|card|paycard)$")

    model_config = ConfigDict(from_attributes=True)

class VNPayPaymentResponse(BaseModel):
    payment_url: str
    txn_ref: str

    model_config = ConfigDict(from_attributes=True)


class VNPayCallbackResponse(BaseModel):
    success: bool
    order_id: str
    status: str
    response_code: str

    model_config = ConfigDict(from_attributes=True)
#endregion

# region ---- Review ----
class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    comment: Optional[str] = Field(None, max_length=1000, description="Review comment")

    model_config = ConfigDict(from_attributes=True)

class ReviewResponse(BaseModel):
    id: str
    target_id: str
    target_type: str
    user_info: UserInfoEmbed
    rating: int
    comment: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ReviewListResponse(BaseModel):
    items: List[ReviewResponse]
    total: int
    skip: int
    limit: int

    model_config = ConfigDict(from_attributes=True)
#endregion

# region ---- Cart ----
class CartItemCreate(BaseModel):
    item_id: str
    quantity: int = Field(..., ge=1, le=10)

    model_config = ConfigDict(from_attributes=True)

class CartItemResponse(BaseModel):
    item_id: str
    quantity: int
    item: Optional[ItemResponse] = None

    model_config = ConfigDict(from_attributes=True)

class CartResponse(BaseModel):
    items: List[CartItemResponse]
    total_amount: float
    expires_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)
#endregion

# region ---- Common ----
class MessageResponse(BaseModel):
    message: str

    model_config = ConfigDict(from_attributes=True)

class PaginatedParams(BaseModel):
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)
    sort_by: Optional[str] = Field(default="created_at")
    order: Optional[str] = Field(default="desc", pattern="^(asc|desc)$")

    model_config = ConfigDict(from_attributes=True)
#endregion

# Forward references
ItemResponse.model_rebuild()