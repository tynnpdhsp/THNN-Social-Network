from typing import Optional

from fastapi import APIRouter, Depends, Query # type: ignore

from app.core.dependencies import get_shop_service, require_active_user
from app.modules.shop.service import ShopService
from app.modules.shop.schemas import (
    CategoryCreate,
    CategoryResponse,
    ItemCreate,
    ItemUpdate,
    ItemResponse,
    ItemListResponse,
    OrderCreate,
    OrderResponse,
    OrderListResponse,
    VNPayCreatePaymentRequest,
    VNPayPaymentResponse,
    VNPayCallbackRequest,
    MessageResponse,
    PaginatedParams,
)

router = APIRouter(prefix="/shop", tags=["Shop"])

# ─── Category Endpoints ───────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryResponse])
async def get_all_categories(
    svc: ShopService = Depends(get_shop_service),
):
    """Get all item categories"""
    return await svc.get_all_categories()


@router.get("/categories/{category_id}", response_model=CategoryResponse)
async def get_category_by_id(
    category_id: str,
    svc: ShopService = Depends(get_shop_service),
):
    """Get category by ID"""
    return await svc.get_category_by_id(category_id)


@router.post("/categories", response_model=CategoryResponse)
async def create_category(
    data: CategoryCreate,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Create new category (admin only)"""
    return await svc.create_category(data, user_id)


# ─── Item Endpoints ───────────────────────────────────────────────────────────

@router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item_by_id(
    item_id: str,
    svc: ShopService = Depends(get_shop_service),
):
    """Get item by ID with details"""
    return await svc.get_item_by_id(item_id)


@router.get("/items", response_model=ItemListResponse)
async def search_items(
    q: Optional[str] = Query(None, description="Search query"),
    category_id: Optional[str] = Query(None, description="Filter by category"),
    seller_id: Optional[str] = Query(None, description="Filter by seller"),
    params: PaginatedParams = Depends(),
    svc: ShopService = Depends(get_shop_service),
):
    """Search and filter items"""
    if category_id:
        return await svc.get_items_by_category(category_id, params)
    elif seller_id:
        return await svc.get_items_by_seller(seller_id, params)
    else:
        return await svc.search_items(q or "", params)


@router.post("/items", response_model=ItemResponse)
async def create_item(
    data: ItemCreate,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Create new item for sale"""
    return await svc.create_item(data, user_id)


@router.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: str,
    data: ItemUpdate,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Update item details (seller only)"""
    return await svc.update_item(item_id, data, user_id)


@router.delete("/items/{item_id}", response_model=MessageResponse)
async def delete_item(
    item_id: str,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Delete item (seller only)"""
    message = await svc.delete_item(item_id, user_id)
    return MessageResponse(message=message)


@router.get("/my-items", response_model=ItemListResponse)
async def get_my_items(
    user_id: str = Depends(require_active_user),
    params: PaginatedParams = Depends(),
    svc: ShopService = Depends(get_shop_service),
):
    """Get current user's items"""
    return await svc.get_items_by_seller(user_id, params)


@router.get("/seller-stats/{seller_id}")
async def get_seller_stats(
    seller_id: str,
    svc: ShopService = Depends(get_shop_service),
):
    """Get seller statistics"""
    return await svc.get_seller_stats(seller_id)


# ─── Order Endpoints ─────────────────────────────────────────────────────────

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
    params: PaginatedParams = Depends(),
    svc: ShopService = Depends(get_shop_service),
):
    """Get current user's purchase orders"""
    return await svc.get_orders_by_buyer(user_id, params)


@router.get("/my-orders/seller", response_model=OrderListResponse)
async def get_my_seller_orders(
    user_id: str = Depends(require_active_user),
    params: PaginatedParams = Depends(),
    svc: ShopService = Depends(get_shop_service),
):
    """Get current user's sales orders"""
    return await svc.get_orders_by_seller(user_id, params)


@router.post("/orders", response_model=OrderResponse)
async def create_order(
    data: OrderCreate,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Create new order"""
    return await svc.create_order(data, user_id)


# ─── Payment Endpoints ───────────────────────────────────────────────────────

@router.post("/payments/vnpay/create", response_model=VNPayPaymentResponse)
async def create_vnpay_payment(
    data: VNPayCreatePaymentRequest,
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Create VNPay payment URL"""
    return await svc.create_vnpay_payment(data, user_id)


@router.post("/payments/vnpay/callback", response_model=MessageResponse)
async def vnpay_callback(
    data: VNPayCallbackRequest,
    svc: ShopService = Depends(get_shop_service),
):
    """Handle VNPay payment callback"""
    message = await svc.handle_vnpay_callback(data)
    return MessageResponse(message=message)


# ─── Rating Endpoints ───────────────────────────────────────────────────────

@router.post("/items/{item_id}/rate", response_model=MessageResponse)
async def rate_item(
    item_id: str,
    rating: int = Query(..., ge=1, le=5, description="Rating from 1 to 5"),
    user_id: str = Depends(require_active_user),
    svc: ShopService = Depends(get_shop_service),
):
    """Rate an item (buyer only after purchase)"""
    # TODO: Verify user purchased the item
    message = await svc.update_item_rating(item_id, rating)
    return MessageResponse(message=message)