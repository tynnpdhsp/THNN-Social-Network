import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, List

from app.core.config import get_settings
from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnauthorizedException,
)
from app.modules.shop.repository import ShopRepository
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
    PaginatedParams,
)

logger = logging.getLogger(__name__)
settings = get_settings()

class ShopService:
    def __init__(self, repo: ShopRepository):
        self.repo = repo

    # ─── Category Service ─────────────────────────────────────────────────────

    async def get_all_categories(self) -> List[CategoryResponse]:
        categories = await self.repo.get_all_categories()
        return [CategoryResponse.model_validate(cat) for cat in categories]

    async def get_category_by_id(self, category_id: str) -> CategoryResponse:
        category = await self.repo.get_category_by_id(category_id)
        if not category:
            raise NotFoundException("Category not found", "CATEGORY_NOT_FOUND")
        return CategoryResponse.model_validate(category)

    async def create_category(self, data: CategoryCreate, user_id: str) -> CategoryResponse:
        existing = await self.repo.get_category_by_name(data.name)
        if existing:
            raise ConflictException("Category name already exists", "CATEGORY_NAME_EXISTS")

        # : Check if user is admin
        # For now, allow any user to create category
        
        category = await self.repo.create_category(data.model_dump())
        return CategoryResponse.model_validate(category)

    # ─── Item Service ────────────────────────────────────────────────────────

    async def get_item_by_id(self, item_id: str) -> ItemResponse:
        item = await self.repo.get_item_by_id(item_id)
        if not item or item.deletedAt:
            raise NotFoundException("Item not found", "ITEM_NOT_FOUND")
        return ItemResponse.model_validate(item)

    async def get_items_by_seller(
        self, seller_id: str, params: PaginatedParams
    ) -> ItemListResponse:
        where_clause = {"sellerId": seller_id, "deletedAt": None}
        
        items = await self.repo.get_items_by_seller(seller_id, params.skip, params.limit)
        total = await self.repo.count_items(where_clause)
        
        return ItemListResponse(
            items=[ItemResponse.model_validate(item) for item in items],
            total=total,
            skip=params.skip,
            limit=params.limit
        )

    async def get_items_by_category(
        self, category_id: str, params: PaginatedParams
    ) -> ItemListResponse:
        # Verify category exists
        category = await self.repo.get_category_by_id(category_id)
        if not category:
            raise NotFoundException("Category not found", "CATEGORY_NOT_FOUND")

        where_clause = {"categoryId": category_id, "status": "active", "deletedAt": None}
        
        items = await self.repo.get_items_by_category(category_id, params.skip, params.limit)
        total = await self.repo.count_items(where_clause)
        
        return ItemListResponse(
            items=[ItemResponse.model_validate(item) for item in items],
            total=total,
            skip=params.skip,
            limit=params.limit
        )

    async def search_items(
        self, query: str, params: PaginatedParams
    ) -> ItemListResponse:
        items = await self.repo.search_items(query, params.skip, params.limit)
        
        # Count total items for search
        where_clause = {"deletedAt": None, "status": "active"}
        if query:
            where_clause["OR"] = [
                {"title": {"contains": query, "mode": "insensitive"}},
                {"description": {"contains": query, "mode": "insensitive"}}
            ]
        
        total = await self.repo.count_items(where_clause)
        
        return ItemListResponse(
            items=[ItemResponse.model_validate(item) for item in items],
            total=total,
            skip=params.skip,
            limit=params.limit
        )

    async def create_item(self, data: ItemCreate, seller_id: str) -> ItemResponse:
        # Verify category exists
        category = await self.repo.get_category_by_id(data.category_id)
        if not category:
            raise NotFoundException("Category not found", "CATEGORY_NOT_FOUND")

        # Create item with seller ID
        item_data = data.model_dump()
        item_data["sellerId"] = seller_id
        
        item = await self.repo.create_item(item_data)
        return ItemResponse.model_validate(item)

    async def update_item(
        self, item_id: str, data: ItemUpdate, user_id: str
    ) -> ItemResponse:
        # Get item and verify ownership
        item = await self.repo.get_item_by_id(item_id)
        if not item or item.deletedAt:
            raise NotFoundException("Item not found", "ITEM_NOT_FOUND")
        
        if item.sellerId != user_id:
            raise UnauthorizedException("You can only update your own items", "NOT_ITEM_OWNER")

        # Update item
        update_data = data.model_dump(exclude_unset=True)
        updated_item = await self.repo.update_item(item_id, update_data)
        return ItemResponse.model_validate(updated_item)

    async def delete_item(self, item_id: str, user_id: str) -> str:
        # Get item and verify ownership
        item = await self.repo.get_item_by_id(item_id)
        if not item or item.deletedAt:
            raise NotFoundException("Item not found", "ITEM_NOT_FOUND")
        
        if item.sellerId != user_id:
            raise UnauthorizedException("You can only delete your own items", "NOT_ITEM_OWNER")

        # Soft delete item
        await self.repo.soft_delete_item(item_id)
        
        # Delete associated images
        await self.repo.delete_images_by_item(item_id)
        
        return "Item deleted successfully"

    async def get_seller_stats(self, seller_id: str) -> dict:
        stats = await self.repo.get_seller_stats(seller_id)
        return stats

    # ─── Order Service ────────────────────────────────────────────────────────

    async def get_order_by_id(self, order_id: str, user_id: str) -> OrderResponse:
        order = await self.repo.get_order_by_id(order_id)
        if not order:
            raise NotFoundException("Order not found", "ORDER_NOT_FOUND")
        
        # Verify user is buyer or seller
        if order.buyerId != user_id and order.sellerId != user_id:
            raise UnauthorizedException("You can only view your own orders", "NOT_ORDER_PARTICIPANT")
        
        return OrderResponse.model_validate(order)

    async def get_orders_by_buyer(
        self, buyer_id: str, params: PaginatedParams
    ) -> OrderListResponse:
        orders = await self.repo.get_orders_by_buyer(buyer_id, params.skip, params.limit)
        total = await self.repo.count_orders_by_buyer(buyer_id)
        
        return OrderListResponse(
            orders=[OrderResponse.model_validate(order) for order in orders],
            total=total,
            skip=params.skip,
            limit=params.limit
        )

    async def get_orders_by_seller(
        self, seller_id: str, params: PaginatedParams
    ) -> OrderListResponse:
        orders = await self.repo.get_orders_by_seller(seller_id, params.skip, params.limit)
        total = await self.repo.count_orders_by_seller(seller_id)
        
        return OrderListResponse(
            orders=[OrderResponse.model_validate(order) for order in orders],
            total=total,
            skip=params.skip,
            limit=params.limit
        )

    async def create_order(self, data: OrderCreate, buyer_id: str) -> OrderResponse:
        # Get item and verify it's available
        item = await self.repo.get_item_by_id(data.item_id)
        if not item or item.deletedAt:
            raise NotFoundException("Item not found", "ITEM_NOT_FOUND")
        
        if item.status != "active":
            raise BadRequestException("Item is not available for purchase", "ITEM_NOT_AVAILABLE")
        
        if item.sellerId == buyer_id:
            raise BadRequestException("You cannot buy your own item", "CANNOT_BUY_OWN_ITEM")

        # Create order
        order_data = data.model_dump()
        order_data["buyerId"] = buyer_id
        order_data["sellerId"] = item.sellerId
        order_data["amount"] = item.price
        
        order = await self.repo.create_order(order_data)
        return OrderResponse.model_validate(order)

    # ─── VNPay Payment Service ─────────────────────────────────────────────────

    async def create_vnpay_payment(
        self, data: VNPayCreatePaymentRequest, user_id: str
    ) -> VNPayPaymentResponse:
        # Verify order exists and belongs to user
        order = await self.repo.get_order_by_id(data.order_id)
        if not order:
            raise NotFoundException("Order not found", "ORDER_NOT_FOUND")
        
        if order.buyerId != user_id:
            raise UnauthorizedException("You can only pay for your own orders", "NOT_ORDER_BUYER")
        
        if order.status != "pending":
            raise BadRequestException("Order is not pending payment", "ORDER_NOT_PENDING")

        # Generate VNPay payment URL
        # TODO: Implement actual VNPay integration
        # This is a placeholder implementation
        
        # Generate unique transaction reference
        txn_ref = f"{order.id}_{int(datetime.now().timestamp())}"
        
        # Update order with transaction reference
        await self.repo.update_order(order.id, {"vnpayTxnRef": txn_ref})
        
        # Mock payment URL (replace with actual VNPay integration)
        payment_url = f"https://sandbox.vnpayment.vn/payment?txn_ref={txn_ref}&amount={data.amount}&return_url={data.return_url}"
        
        return VNPayPaymentResponse(
            payment_url=payment_url,
            txn_ref=txn_ref
        )

    async def handle_vnpay_callback(self, data: VNPayCallbackRequest) -> str:
        # Find order by transaction reference
        order = await self.repo.get_order_by_vnpay_ref(data.vnp_TxnRef)
        if not order:
            raise NotFoundException("Order not found", "ORDER_NOT_FOUND")

        # Process payment result
        if data.vnp_ResponseCode == "00" and data.vnp_TransactionStatus == "00":
            # Payment successful
            await self.repo.update_order(
                order.id,
                {
                    "status": "paid",
                    "vnpayResponseCode": data.vnp_ResponseCode,
                    "paidAt": datetime.now(timezone.utc)
                }
            )
            
            # Update item status to sold
            await self.repo.update_item(order.itemId, {"status": "sold"})
            
            return "Payment successful"
        else:
            # Payment failed
            await self.repo.update_order(
                order.id,
                {
                    "status": "failed",
                    "vnpayResponseCode": data.vnp_ResponseCode
                }
            )
            
            return "Payment failed"

    # ─── Rating Service ───────────────────────────────────────────────────────

    async def update_item_rating(self, item_id: str, new_rating: int) -> str:
        # Get current item
        item = await self.repo.get_item_by_id(item_id)
        if not item:
            raise NotFoundException("Item not found", "ITEM_NOT_FOUND")

        # Calculate new average rating
        # This is a simplified calculation - in practice, you'd store all ratings
        current_total = item.avgRating * item.ratingCount
        new_total = current_total + new_rating
        new_count = item.ratingCount + 1
        new_avg = new_total / new_count

        # Update item rating
        await self.repo.update_item_rating(item_id, new_avg, new_count)
        
        return "Rating updated successfully"