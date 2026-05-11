from typing import Optional

from fastapi import APIRouter, Depends, Query, UploadFile, File, Body, Request # type: ignore

from app.core.config import get_settings
from app.core.dependencies import get_shop_service, require_active_user, require_admin
from app.core.exceptions import BadRequestException
from app.modules.shop.service import ShopService
from app.modules.shop.schemas import (
    CategoryCreate, CategoryResponse, CategoryUpdate,
    ItemCreate, ItemUpdate, ItemResponse, ItemListResponse, ItemListQuery, ItemPaginationRequest,
    OrderCreate, OrderResponse, OrderListResponse,
    VNPayCreatePaymentRequest, VNPayPaymentResponse,
    ReviewCreate, ReviewResponse, ReviewListResponse,
    CartItemCreate, CartItemResponse, CartResponse,
    MessageResponse, PaginatedParams, VNPayCallbackResponse
)

router = APIRouter(prefix="/shop", tags=["Shop"])
settings = get_settings()

# region---- Category ----
@router.get("/categories", response_model=list[CategoryResponse])
async def get_all_categories(
    svc: ShopService = Depends(get_shop_service),
):
    """Get all item categories"""
    return await svc.get_all_categories()

@router.post("/categories", response_model=CategoryResponse)
async def create_category(
    data: CategoryCreate,
    admin_id: str = Depends(require_admin),
    svc: ShopService = Depends(get_shop_service),
):
    """Create new category (admin only)"""
    return await svc.create_category(data)

@router.patch("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    data: CategoryUpdate,
    admin_id: str = Depends(require_admin),
    svc: ShopService = Depends(get_shop_service)
):
    """Update category (admin only)"""
    return await svc.update_category(category_id, data)

@router.delete("/categories/{category_id}", response_model=CategoryResponse)
async def delete_category(
    category_id: str,
    admin_id: str = Depends(require_admin),
    svc: ShopService = Depends(get_shop_service)
):
    """Delete category (admin only)"""
    return await svc.delete_category(category_id)
#endregion

# region---- Items ----
@router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item_by_id(
    item_id: str,
    svc: ShopService = Depends(get_shop_service),
):
    """Get item by ID with details"""
    return await svc.get_item_by_id(item_id)

@router.get("/items", response_model=ItemListResponse)
async def get_items(
    q: Optional[str] = Query(None, description="Search query"),
    category_id: Optional[str] = Query(None, description="Filter by category"),
    sort: Optional[str] = Query("newest", description="Sort order"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return"),
    svc: ShopService = Depends(get_shop_service),
):
    """Get items with pagination, sorting and filtering"""
    query = ItemListQuery(
        skip=skip,
        limit=limit,
        sort=sort,
        category_id=category_id,
        search=q
    )
    return await svc.get_items(query)

@router.get("/my-items", response_model=ItemListResponse)
async def get_my_items(
    user_id: str = Depends(require_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    svc: ShopService = Depends(get_shop_service),
):
    """Get current user's items"""
    query = ItemPaginationRequest(skip=skip, limit=limit)
    return await svc.get_my_items(user_id, query)

@router.post("/items/upload-images", response_model=dict)
async def upload_item_images(
    files: list[UploadFile] = File(...),
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Upload multiple images for item creation"""

    # Validate all files are images
    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise BadRequestException(
                "Tất cả file phải là hình ảnh",
                "INVALID_FILE_TYPE"
            )

    # Check total size + convert to bytes once
    total_size = 0
    processed_files: list[tuple[bytes, str]] = []

    for file in files:
        content = await file.read()
        total_size += len(content)

        processed_files.append(
            (content, file.filename)
        )

    max_bytes = settings.MAX_AVATAR_SIZE_MB * 1024 * 1024

    if total_size > max_bytes:
        raise BadRequestException(
            f"Tổng kích thước ảnh phải nhỏ hơn {settings.MAX_AVATAR_SIZE_MB}MB",
            "FILE_TOO_LARGE"
        )

    # Upload using bytes instead of UploadFile
    image_urls = await svc.upload_item_images(
        user_id=user_id,
        files=processed_files
    )

    return {
        "image_urls": image_urls
    }

@router.post("/items", response_model=ItemResponse)
async def create_item(
    data: ItemCreate,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Create new item"""
    return await svc.create_item(data, user_id)

@router.patch("/items/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: str,
    data: ItemUpdate,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service)
):
    """Update item (owner only)"""
    return await svc.update_item(item_id, data, user_id)

@router.delete("/items/{item_id}", response_model=ItemResponse)
async def delete_item(
    item_id: str,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service)
):
    """Delete item (owner only)"""
    return await svc.delete_item(item_id, user_id)
#endregion

# region---- Reviews ----
@router.post("/items/{item_id}/reviews", response_model=ReviewResponse)
async def create_item_review(
    item_id: str,
    data: ReviewCreate,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Create a review for an item (buyer only after purchase)"""
    return await svc.create_item_review(item_id, user_id, data)

@router.get("/items/{item_id}/reviews", response_model=ReviewListResponse)
async def get_item_reviews(
    item_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    svc: ShopService = Depends(get_shop_service),
):
    """Get reviews for an item"""
    return await svc.get_item_reviews(item_id, skip, limit)

@router.delete("/reviews/{review_id}")
async def delete_item_review(
    review_id: str,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Delete review (review owner only)"""
    await svc.delete_item_review(review_id, user_id)
    return {"message": "Review deleted successfully"}
#endregion

# region---- Order Endpoints ----
@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order_by_id(
    order_id: str,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Get order by ID (buyer or seller only)"""
    return await svc.get_order_by_id(order_id, user_id)

@router.get("/my-orders/buyer", response_model=OrderListResponse)
async def get_my_buyer_orders(
    user_id: str = Depends(require_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    svc: ShopService = Depends(get_shop_service),
):
    """Get current user's purchase orders"""
    return await svc.get_orders_by_buyer(user_id, skip, limit)

@router.get("/my-orders/seller", response_model=OrderListResponse)
async def get_my_seller_orders(
    user_id: str = Depends(require_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    svc: ShopService = Depends(get_shop_service),
):
    """Get current user's sales orders"""
    return await svc.get_orders_by_seller(user_id, skip, limit)

@router.post("/orders", response_model=OrderResponse)
async def create_order(
    data: OrderCreate,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Create new order"""
    return await svc.create_order(data, user_id)
#endregion

# region---- Cart Endpoints ----
@router.get("/cart", response_model=CartResponse)
async def get_cart(
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Get current user's cart"""
    return await svc.get_cart(user_id)

@router.post("/cart", response_model=CartItemResponse)
async def add_to_cart(
    data: CartItemCreate,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Add item to cart"""
    return await svc.add_to_cart(user_id, data)

@router.patch("/cart/{item_id}", response_model=CartItemResponse)
async def update_cart_item(
    item_id: str,
    quantity: int = Body(..., embed=True),
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Update item quantity in cart"""
    return await svc.update_cart_item(user_id, item_id, quantity)

@router.delete("/cart/{item_id}", response_model=MessageResponse)
async def remove_from_cart(
    item_id: str,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Remove item from cart"""
    return await svc.remove_from_cart(user_id, item_id)

@router.delete("/cart", response_model=MessageResponse)
async def clear_cart(
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Clear entire cart"""
    return await svc.clear_cart(user_id)
#endregion

# region---- Payment Endpoints ----
@router.post("/vnpay/create-url", response_model=VNPayPaymentResponse)
async def create_vnpay_payment(
    data: VNPayCreatePaymentRequest,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Create VNPay payment URL"""
    return await svc.create_vnpay_payment(data, user_id)

@router.get("/vnpay/callback", response_model=VNPayCallbackResponse)
async def vnpay_callback(
    request: Request,
    svc: ShopService = Depends(get_shop_service),
):
    """Handle VNPay payment callback"""
    print("=== VNPay IPN Callback endpoint accessed ===")
    params = dict(request.query_params)
    print(f"Query parameters received: {params}")
    result = await svc.handle_vnpay_callback(params)
    return VNPayCallbackResponse(**result)
#endregion

#endregion

# region---- Hot Items Endpoints ----
@router.get("/items/hot", response_model=list[str])
async def get_hot_items(
    limit: int = Query(10, ge=1, le=50, description="Number of hot items to return"),
    svc: ShopService = Depends(get_shop_service),
):
    """Get list of hot item IDs"""
    return await svc.get_hot_items(limit)
#endregion