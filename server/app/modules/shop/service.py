from datetime import datetime, timedelta
import hashlib
import hmac
import urllib

from app.modules.shop.schemas import (
    CategoryCreate, CategoryResponse, CategoryUpdate,
    ItemCreate, ItemUpdate, ItemResponse, ItemListResponse, ItemListQuery, ItemPaginationRequest,
    ImageResponse,
    OrderCreate, OrderResponse, OrderListResponse,
    VNPayCreatePaymentRequest, VNPayPaymentResponse,
    ReviewCreate, ReviewResponse, ReviewListResponse,
    CartItemCreate, CartItemResponse, CartResponse,
    MessageResponse, PaginatedParams,
    UserInfoEmbed
)
import logging
from app.utils.storage import upload_files

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.modules.shop.repository import ShopRepository
from prisma.models import ShopItem, User # type: ignore
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class ShopService:
    def __init__(self, repo: ShopRepository):
        self.repo = repo

    # region---- Category ----
    async def create_category(self, data: CategoryCreate) -> CategoryResponse:
        existing = await self.repo.get_category_by_name(data.name)
        if existing:
            raise ConflictException("Category name already exists", "CATEGORY_NAME_EXISTS")
        
        return await self.repo.create_category(data.model_dump())
    
    async def get_all_categories(self) -> list[CategoryResponse]:
        categories = await self.repo.get_all_categories()
        return [CategoryResponse.model_validate(cate) for cate in categories]
    
    async def update_category(self, category_id: str, data: CategoryUpdate) -> CategoryResponse:
        existing_category = await self.repo.get_category_by_id(category_id)
        if not existing_category:
            raise NotFoundException("Category not found", "CATEGORY_NOT_FOUND")
        
        existing_by_name = await self.repo.get_category_by_name(data.name)
        if existing_by_name and existing_by_name.id != category_id:
            raise ConflictException("Category name already exists", "CATEGORY_NAME_EXISTS")
        
        updated_category = await self.repo.update_category(category_id, data.model_dump())
        return CategoryResponse.model_validate(updated_category)
    
    async def delete_category(self, category_id: str) -> CategoryResponse:
        existing_category = await self.repo.get_category_by_id(category_id)
        if not existing_category:
            raise NotFoundException("Category not found", "CATEGORY_NOT_FOUND")
        
        deleted_category = await self.repo.delete_category(category_id)
        return CategoryResponse.model_validate(deleted_category)
    # endregion

    # region ---- Items ----
    async def get_item_by_id(self, item_id: str) -> ItemResponse:
        return self._map_item_to_response(await self.repo.get_item_by_id(item_id))
    
    async def get_items(self, query: ItemListQuery) -> ItemListResponse:
        """Get items with pagination, sorting and filtering"""
        # Get items and total count
        items = await self.repo.get_items(
            skip=query.skip,
            limit=query.limit,
            sort=query.sort,
            category_id=query.category_id,
            search=query.search
        )
        
        total = await self.repo.count_items(
            category_id=query.category_id,
            search=query.search
        )
        
        items_list = [self._map_item_to_response(item) for item in items]
        
        return ItemListResponse(
            total=total,
            items=items_list,
            skip=query.skip,
            limit=query.limit
        )
    
    async def get_my_items(self, seller_id: str, query: ItemPaginationRequest) -> ItemListResponse:
        items = await self.repo.get_my_items(seller_id, query.skip, query.limit)
        total = await self.repo.count_items(None, None, seller_id)

        return ItemListResponse(
            total=total,
            items=[self._map_item_to_response(item) for item in items],
            skip=query.skip,
            limit=query.limit
        )

    async def upload_item_images(
        self,
        user_id: str,
        files: list[tuple[bytes, str]]
    ) -> list[str]:
        """Upload multiple item images to MinIO storage"""

        try:
            image_urls = await upload_files(
                files=files,
                prefix=f"shop/items/{user_id}"
            )

            return image_urls

        except Exception as e:
            logger.error(
                f"Failed to upload item images for user {user_id}: {str(e)}"
            )
            raise BadRequestException(
                "Failed to upload images",
                "UPLOAD_FAILED"
            )

    async def create_item(self, data: ItemCreate, user_id: str) -> ItemResponse:
        """Create item with images in transaction"""
        item_data = {
            "sellerId": user_id,
            "categoryId": data.category_id,
            "title": data.title,
            "description": data.description,
            "price": data.price,
            "status": "active",
            "deletedAt": None
        }
        
        # Create item with images in transaction
        item = await self.repo.create_item(item_data, data.image_urls)
        
        return self._map_item_to_response(item)

    async def update_item(self, item_id: str, data: ItemUpdate, user_id: str) -> ItemResponse:
        """Update item with cache invalidation"""
        item = await self.repo.get_item_by_id(item_id)
        if not item:
            raise NotFoundException("Item not found", "ITEM_NOT_FOUND")
        
        # Check ownership (only owner can update)
        if item.sellerId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        # Prepare update data (only include non-None fields)
        update_data = {}
        if data.title is not None:
            update_data["title"] = data.title
        if data.description is not None:
            update_data["description"] = data.description
        if data.price is not None:
            update_data["price"] = data.price
        if data.status is not None:
            update_data["status"] = data.status
        
        if not update_data:
            raise ValueError("No fields to update")
        
        try:
            updated_item = await self.repo.update_item(item_id, update_data)
            return self._map_item_to_response(updated_item)
            
        except Exception as e:
            raise e

    async def delete_item(self, item_id: str, user_id: str) -> ItemResponse:
        """Delete item with cleanup"""
        # Get item first to check ownership
        item = await self.repo.get_item_by_id(item_id)
        if not item:
            raise NotFoundException("Item not found", "ITEM_NOT_FOUND")
        
        # Check ownership (only owner or admin can delete)
        if item.sellerId != user_id:
            user = await self.repo.db.user.find_unique(
                where={"id": user_id},
                include={"roleRef": True}
            )
            if not user or not user.roleRef or user.roleRef.role != "admin":
                raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        try:
            # Delete item from database (soft delete)
            deleted_item = await self.repo.delete_item(item_id)
            return self._map_item_to_response(deleted_item)
            
        except Exception as e:
            raise e
    # endregion

    # region ---- Reviews ----
    async def create_item_review(self, item_id: str, user_id: str, data: ReviewCreate) -> ReviewResponse:
        """Create or update review for item with transaction"""
        item = await self.repo.get_item_by_id(item_id)
        if not item:
            raise NotFoundException("Item not found", "ITEM_NOT_FOUND")

        
        user = await self.repo.db.user.find_unique(where={"id": user_id})
        if not user:
            raise NotFoundException("User not found", "USER_NOT_FOUND")
        
        user_info = {
            "id": user.id,
            "full_name": user.fullName,
            "avatar_url": user.avatarUrl or None
        }
        
        review, rating_data = await self.repo.create_review_with_transaction(
            item_id, user_id, user_info, data.rating, data.comment
        )
        
        return self._map_review_to_response(review)
    
    async def get_item_reviews(self, item_id: str, skip: int = 0, limit: int = 20) -> ReviewListResponse:
        """Get reviews for a item with pagination"""
        # Check if item exists
        item = await self.repo.get_item_by_id(item_id)
        if not item:
            raise NotFoundException("Item not found", "ITEM_NOT_FOUND")
        
        reviews = await self.repo.get_item_reviews(item_id, skip, limit)
        total = await self.repo.count_reviews(item_id)
        
        items = [self._map_review_to_response(review) for review in reviews]
        
        return ReviewListResponse(
            total=total,
            items=items,
            skip=skip,
            limit=limit
        )
    
    async def delete_item_review(self, review_id: str, user_id: str) -> dict:
        """Delete review for item with transaction"""
        review = await self.repo.get_review_by_id(review_id)
        if not review:
            raise NotFoundException("Review not found", "REVIEW_NOT_FOUND")
        
        # Check if user owns this review
        user_info = review.userInfo if isinstance(review.userInfo, dict) else {}
        if user_info.get("id") != user_id:
            raise ForbiddenException("Can't access to delete review", "Forbidden_DELETE_REVIEW")
        
        result = await self.repo.delete_review_with_transaction(review_id)
        
        return result
    # endregion

# region ---- Order ----
    async def create_order(self, data: OrderCreate, user_id: str) -> OrderResponse:
        """Create new order"""
        itemExisting = await self.repo.get_item_by_id(data.item_id)
        if not itemExisting:
            raise NotFoundException("Item not found", "ITEM_NOT_FOUND")
        
        try:
            order = await self.repo.create_order(data, user_id, itemExisting.sellerId)
            return self._map_order_to_response(order)
        except Exception as e:
            logger.error(f"Lỗi khi tạo đơn hàng: {str(e)}", exc_info=True)
            raise e

    async def get_order_by_id(self, order_id: str, user_id: str) -> OrderResponse:
        """Get order by ID (buyer or seller only)"""
        order = await self.repo.get_order_by_id(order_id)
        if not order:
            raise NotFoundException("Order not found", "ORDER_NOT_FOUND")
        
        # Check if user is buyer or seller
        if order.buyerId != user_id and order.sellerId != user_id:
            raise ForbiddenException("Access denied", "ORDER_ACCESS_DENIED")
        
        return self._map_order_to_response(order)

    async def get_orders_by_buyer(self, buyer_id: str, skip: int = 0, limit: int = 20) -> OrderListResponse:
        """Get orders by buyer ID"""
        orders = await self.repo.get_orders_by_buyer(buyer_id, skip, limit)
        total = await self.repo.count_orders_by_buyer(buyer_id)
        
        order_list = [self._map_order_to_response(order) for order in orders]
        
        return OrderListResponse(
            total=total,
            orders=order_list,
            skip=skip,
            limit=limit
        )

    async def get_orders_by_seller(self, seller_id: str, skip: int = 0, limit: int = 20) -> OrderListResponse:
        """Get orders by seller ID"""
        orders = await self.repo.get_orders_by_seller(seller_id, skip, limit)
        total = await self.repo.count_orders_by_seller(seller_id)
        
        order_list = [self._map_order_to_response(order) for order in orders]
        
        return OrderListResponse(
            total=total,
            orders=order_list,
            skip=skip,
            limit=limit
        )
    # endregion

    # region ---- VNPay Payment ----
    async def create_vnpay_payment(self, data: VNPayCreatePaymentRequest, user_id: str) -> VNPayPaymentResponse:
        """Create VNPay payment URL"""
        order = await self.repo.get_order_by_id(data.order_id)
        if not order:
            raise NotFoundException("Order not found", "ORDER_NOT_FOUND")

        now = datetime.now() + timedelta(hours=7)
        create_date = now.strftime("%Y%m%d%H%M%S")
        expire_date = (now + timedelta(minutes=15)).strftime("%Y%m%d%H%M%S") # hết hạn sau 15 phút
        amount = int(order.amount * 100)

        vnp_params = {
            "vnp_Version": "2.1.0",
            "vnp_Command": "pay",
            "vnp_TmnCode": settings.VNPAY_TMN_CODE, # mã merchant do VNPay cấp
            "vnp_Amount": amount,
            "vnp_CreateDate": create_date,
            "vnp_CurrCode": "VND",
            "vnp_IpAddr": data.ip_addr, # IP thật từ request
            "vnp_Locale": "vn",
            "vnp_OrderInfo": f"Thanh toan don hang {order.id}",
            "vnp_OrderType": data.order_type,
            "vnp_ReturnUrl": settings.VNPAY_RETURN_URL, # callback url public domain cho frontend
            "vnp_ExpireDate": expire_date,
            "vnp_TxnRef": order.vnpayTxnRef,
        }
        sorted_params = sorted(vnp_params.items())
        hash_data = urllib.parse.urlencode(sorted_params)

        secure_hash = hmac.new(
            settings.VNPAY_HASH_SECRET.encode("utf-8"),
            hash_data.encode("utf-8"),
            hashlib.sha512
        ).hexdigest()
        
        payment_url = f"{settings.VNPAY_URL}?{hash_data}&vnp_SecureHash={secure_hash}"

        return VNPayPaymentResponse(
            payment_url=payment_url,
            txn_ref=order.vnpayTxnRef
        )

    async def handle_vnpay_callback(self, params: dict) -> dict:
        """Handle VNPay payment callback with signature verification"""
        
        # 1. Verify signature
        vnp_secure_hash = params.get("vnp_SecureHash")
        if not vnp_secure_hash:
            raise BadRequestException("Missing VNPay signature", "VNPAY_MISSING_SIGNATURE")
        
        # Remove hash params from data to verify
        hash_data = {k: v for k, v in params.items() if k.startswith("vnp_") and k not in ["vnp_SecureHash", "vnp_SecureHashType"]}
        
        if not self._verify_vnpay_signature(hash_data, vnp_secure_hash):
            raise BadRequestException("Invalid VNPay signature", "VNPAY_INVALID_SIGNATURE")

        # 2. Extract data
        vnp_txn_ref = params.get("vnp_TxnRef")
        vnp_response_code = params.get("vnp_ResponseCode")
        vnp_transaction_status = params.get("vnp_TransactionStatus")
        
        order = await self.repo.get_order_by_vnpay_ref(vnp_txn_ref)
        if not order:
            raise NotFoundException("Order not found", "ORDER_NOT_FOUND")
        
        # 3. Check if payment is successful
        if vnp_response_code == "00" and vnp_transaction_status == "00":
            # Payment successful - update order status
            update_data = {
                "status": "paid",
                "vnpayResponseCode": vnp_response_code,
                "paidAt": datetime.now()
            }
        else:
            # Payment failed - update order status
            update_data = {
                "status": "failed",
                "vnpayResponseCode": vnp_response_code
            }
        
        # Update order with payment result
        updated_order = await self.repo.update_order(order.id, update_data)
        
        result = {
            "success": vnp_response_code == "00" and vnp_transaction_status == "00",
            "order_id": updated_order.id,
            "status": updated_order.status,
            "response_code": vnp_response_code
        }
        
        return result

    def _verify_vnpay_signature(self, params: dict, secure_hash: str) -> bool:
        """Verify VNPay HMAC-SHA512 signature"""
        sorted_params = sorted(params.items())
        hash_data = urllib.parse.urlencode(sorted_params, quote_via=urllib.parse.quote)
        
        calculated_hash = hmac.new(
            settings.VNPAY_HASH_SECRET.encode("utf-8"),
            hash_data.encode("utf-8"),
            hashlib.sha512
        ).hexdigest()
        return calculated_hash.lower() == secure_hash.lower()

    # endregion

    # region ---- Cart ----
    async def get_cart(self, user_id: str) -> CartResponse:
        """Get user's cart with total amount"""
        cart_items = await self.repo.get_cart_items(user_id)
        
        items = []
        total_amount = 0.0
        
        for item in cart_items:
            # Map item to response
            item_resp = self._map_item_to_response(item.item)
            items.append(CartItemResponse(
                item_id=item.itemId,
                quantity=item.quantity,
                item=item_resp
            ))
            total_amount += item.item.price * item.quantity
            
        return CartResponse(
            items=items,
            total_amount=total_amount,
            expires_at=None # Can be implemented later if needed
        )

    async def add_to_cart(self, user_id: str, data: CartItemCreate) -> CartItemResponse:
        """Add item to cart"""
        item_existing = await self.repo.get_item_by_id(data.item_id)
        if not item_existing:
            raise NotFoundException("Item not found", "ITEM_NOT_FOUND")
            
        cart_item = await self.repo.add_to_cart(user_id, data.item_id, data.quantity)
        
        return CartItemResponse(
            item_id=cart_item.itemId,
            quantity=cart_item.quantity,
            item=self._map_item_to_response(cart_item.item)
        )

    async def update_cart_item(self, user_id: str, item_id: str, quantity: int) -> CartItemResponse:
        """Update quantity of an item in cart"""
        try:
            cart_item = await self.repo.update_cart_item(user_id, item_id, quantity)
            return CartItemResponse(
                item_id=cart_item.itemId,
                quantity=cart_item.quantity,
                item=self._map_item_to_response(cart_item.item)
            )
        except Exception:
            raise NotFoundException("Item not found in cart", "CART_ITEM_NOT_FOUND")

    async def remove_from_cart(self, user_id: str, item_id: str) -> MessageResponse:
        """Remove item from cart"""
        try:
            await self.repo.remove_from_cart(user_id, item_id)
            return MessageResponse(message="Item removed from cart")
        except Exception:
            raise NotFoundException("Item not found in cart", "CART_ITEM_NOT_FOUND")

    async def clear_cart(self, user_id: str) -> MessageResponse:
        """Clear user's cart"""
        await self.repo.clear_cart(user_id)
        return MessageResponse(message="Cart cleared")
    # endregion

# region ---- Helper ----
    def _map_item_to_response(self, item: ShopItem) -> ItemResponse:
        """Map ShopItem model to ItemResponse"""
        user_info = None
        if hasattr(item, "seller") and item.seller:
            user_info = UserInfoEmbed(id=item.seller.id, full_name=item.seller.fullName, avatar_url=item.seller.avatarUrl)

        category = None
        if hasattr(item, "category") and item.category:
            category = CategoryResponse(id=item.category.id, name=item.category.name)

        # _p = "https" if settings.MINIO_SECURE else "http"
        # domain = f"{_p}://{settings.MINIO_ENDPOINT}"
        images = []
        if hasattr(item, "itemImages") and item.itemImages:
            for img in item.itemImages:
                url = img.imageUrl
                # if not url.startswith("http://") and not url.startswith("https://"):
                #     url = f"{domain}{url}"
                images.append(ImageResponse(image_url=url, display_order=img.displayOrder))

        return ItemResponse(
            id=item.id,
            seller_id=item.sellerId,
            category_id=item.categoryId,
            title=item.title,
            description=item.description,
            price=item.price,
            avg_rating=item.avgRating,
            rating_count=item.ratingCount,
            status=item.status,
            created_at=item.createdAt,
            updated_at=item.updatedAt,
            user_info=user_info,
            category=category,
            images=images
        )

    def _map_order_to_response(self, order) -> OrderResponse:
        """Map Order model to OrderResponse"""
        # item = None
        # if hasattr(order, "item") and order.item:
        #     item = ItemResponse(
        #         id=order.item.id,
        #         seller_id=order.item.sellerId,
        #         category_id=order.item.categoryId,
        #         title=order.item.title,
        #         description=order.item.description,
        #         price=order.item.price,
        #         avg_rating=order.item.avgRating,
        #         rating_count=order.item.ratingCount,
        #         status=order.item.status,
        #         created_at=order.item.createdAt,
        #         updated_at=order.item.updatedAt,
        #         images=[],
        #         user_info=None,
        #         category=None
        #     )
        
        sellerId = None
        if hasattr(order, "seller") and order.seller:
            sellerId = order.seller.id
        elif hasattr(order, "sellerId"):
            sellerId = order.sellerId

        return OrderResponse(
            id=order.id,
            buyer_id=order.buyerId,
            item_id=order.itemId,
            seller_id=sellerId,
            amount=order.amount,
            status=order.status,
            payment_method=order.paymentMethod,
            vnpay_txn_ref=order.vnpayTxnRef or None,
            vnpay_response_code=order.vnpayResponseCode or None,
            paid_at=order.paidAt,
            created_at=order.createdAt,
            updated_at=order.updatedAt,
            # item=item
        )

    def _map_review_to_response(self, review) -> ReviewResponse:
        """Map Review model to ReviewResponse"""
        user_info = review.userInfo if isinstance(review.userInfo, dict) else {}
        
        return ReviewResponse(
            id=review.id,
            target_id=review.targetId,
            target_type=review.targetType,
            user_info=UserInfoEmbed(
                id=user_info.get("id", ""),
                full_name=user_info.get("full_name", ""),
                avatar_url=user_info.get("avatar_url")
            ),
            rating=review.rating,
            comment=review.comment,
            created_at=review.createdAt
        )
    async def get_hot_items(self, limit: int) -> list[str]:
        """Get hot item IDs based on rating and count"""
        items = await self.repo.get_items(limit=limit, sort="rating")
        return [item.id for item in items]
# endregion

