from typing import Optional
from prisma import Prisma
from prisma.models import ItemCategory, ShopItem, ItemImage, Order, Review, User
from prisma import Json
from datetime import datetime

from app.modules.shop.schemas import OrderCreate

class ShopRepository:
    def __init__(self, db: Prisma):
        self.db = db

    # region---- Category ----
    async def get_category_by_id(self, category_id: str) -> Optional[ItemCategory]:
        return await self.db.itemcategory.find_unique(where={"id": category_id})

    async def get_category_by_name(self, name: str) -> Optional[ItemCategory]:
        return await self.db.itemcategory.find_unique(where={"name": name})

    async def get_all_categories(self) -> list[ItemCategory]:
        return await self.db.itemcategory.find_many(order={"createdAt": "asc"})

    async def create_category(self, data: dict) -> ItemCategory:
        return await self.db.itemcategory.create(data=data)

    async def update_category(self, category_id: str, data: dict) -> ItemCategory:
        return await self.db.itemcategory.update(where={"id": category_id}, data=data)

    async def delete_category(self, category_id: str) -> ItemCategory: 
        return await self.db.itemcategory.delete(where={"id": category_id})
    # endregion

    # region ---- Items ----
    async def get_item_by_id(self, item_id: str) -> Optional[ShopItem]:
        return await self.db.shopitem.find_unique(
            where={"id": item_id},
            include={
                "category": True,
                "itemImages": True,
                "seller": True,
            }
        )

    async def get_items(
        self, 
        skip: int = 0, 
        limit: int = 20,
        sort: str = "newest",
        category_id: Optional[str] = None, 
        search: Optional[str] = None,
        seller_id: Optional[str] = None
    ) -> list[ShopItem]:
        """Get items with filtering and sorting"""
        where_conditions = {"deletedAt": None, "status": "active"}
        
        # Category filter
        if category_id:
            where_conditions["categoryId"] = category_id
        
        # Seller filter
        if seller_id:
            where_conditions["sellerId"] = seller_id
        
        # Search filter
        if search:
            where_conditions["OR"] = [
                {"title": {"contains": search, "mode": "insensitive"}},
                {"description": {"contains": search, "mode": "insensitive"}}
            ]
        
        # Sort mapping
        sort_mapping = {
            "rating": {"avgRating": "desc"},
            "popular": {"ratingCount": "desc"},
            "newest": {"createdAt": "desc"},
            "oldest": {"createdAt": "asc"},
            "price_low": {"price": "asc"},
            "price_high": {"price": "desc"}
        }
        
        order_by = sort_mapping.get(sort, {"createdAt": "desc"})
        
        return await self.db.shopitem.find_many(
            where=where_conditions,
            include={
                "category": True, 
                "itemImages": True,
                "seller": True,
            },
            skip=skip,
            take=limit,
            order=order_by
        )

    async def get_my_items(self, seller_id: str, skip: int = 0, limit: int = 20) -> list[ShopItem]:
        items = await self.db.shopitem.find_many(
            where={"sellerId": seller_id, "deletedAt": None},
            include={
                "category": True,
                "itemImages": {"order_by": {"displayOrder": "asc"}},
            },
            skip=skip,
            take=limit,
            order={"createdAt": "desc"}
        )

        return items
    
    async def count_items(
        self, 
        category_id: Optional[str] = None, 
        search: Optional[str] = None,
        seller_id: Optional[str] = None
    ) -> int:
        """Count items with filtering"""
        where_conditions = {"deletedAt": None, "status": "active"}
        
        if seller_id:
            where_conditions["sellerId"] = seller_id

        # Category filter
        if category_id:
            where_conditions["categoryId"] = category_id
        
        # Search filter
        if search:
            where_conditions["OR"] = [
                {"title": {"contains": search, "mode": "insensitive"}},
                {"description": {"contains": search, "mode": "insensitive"}}
            ]
        
        return await self.db.shopitem.count(where=where_conditions)

    async def create_item(
        self,
        data: dict,
        image_urls: Optional[list[str]] = None
    ) -> ShopItem:
        """Create item with images in transaction"""
        async with self.db.tx() as tx:
            try:
                item = await tx.shopitem.create(data=data)
                
                if image_urls:
                    image_data = []
                    for index, image_url in enumerate(image_urls):
                        image_data.append({
                            "itemId": item.id,
                            "imageUrl": image_url,
                            "displayOrder": index
                        })
                    await tx.itemimage.create_many(
                        data=image_data
                    )

                full_item = await tx.shopitem.find_unique(
                    where={
                        "id": item.id
                    },
                    include={
                        "category": True,
                        "seller": True,
                        "itemImages": True
                    }
                )
                return full_item
            except Exception as e:
                raise e

    async def update_item(self, item_id: str, data: dict) -> ShopItem:
        return await self.db.shopitem.update(
            where={"id": item_id},
            data=data,
            include={"category": True, "itemImages": {"order_by": {"displayOrder": "asc"}}, "seller": True}
        )

    async def delete_item(self, item_id: str) -> ShopItem:
        """Soft delete item"""
        return await self.db.shopitem.update(
            where={"id": item_id},
            data={"deletedAt": datetime.now()},
            include={"category": True, "itemImages": True, "seller": True}
        )
    # endregion

    
    # region ---- Orders ----
    async def get_order_by_id(self, order_id: str) -> Optional[Order]:
        return await self.db.order.find_unique(
            where={"id": order_id},
            include={
                "item": {
                    "include": {"category": True, "itemImages": {"take": 1}}
                },
                "buyer": True,
                "seller": True
            }
        )

    async def get_orders_by_buyer(self, buyer_id: str, skip: int = 0, limit: int = 20) -> list[Order]:
        return await self.db.order.find_many(
            where={"buyerId": buyer_id},
            include={"item": {"include": {"category": True}}},
            order={"createdAt": "desc"},
            skip=skip,
            take=limit
        )

    async def get_orders_by_seller(self, seller_id: str, skip: int = 0, limit: int = 20) -> list[Order]:
        return await self.db.order.find_many(
            where={"sellerId": seller_id},
            include={"item": {"include": {"category": True}}},
            order={"createdAt": "desc"},
            skip=skip,
            take=limit
        )

    async def count_orders_by_buyer(self, buyer_id: str) -> int:
        return await self.db.order.count(where={"buyerId": buyer_id})

    async def count_orders_by_seller(self, seller_id: str) -> int:
        return await self.db.order.count(where={"sellerId": seller_id})

    async def create_order(self, data: OrderCreate, user_id: str, seller_id: str) -> Order:
        import uuid
        return await self.db.order.create(
            data={
                "buyerId": user_id,
                "sellerId": seller_id,
                "itemId": data.item_id,
                "paymentMethod": data.payment_method,
                "vnpayTxnRef": uuid.uuid4().hex[:12].upper(),
                "amount": data.amount,
                "status": "pending"
            },
            include={"item": {"include": {"category": True}}}
        )

    async def update_order(self, order_id: str, data: dict) -> Order:
        return await self.db.order.update(
            where={"id": order_id},
            data=data,
            include={"item": {"include": {"category": True}}}
        )

    async def get_order_by_vnpay_ref(self, vnpay_txn_ref: str) -> Optional[Order]:
        return await self.db.order.find_unique(
            where={"vnpayTxnRef": vnpay_txn_ref},
            include={"item": {"include": {"category": True}}}
        )
    # endregion

    # region ---- Reviews ----
    async def get_user_review(self, user_id: str, item_id: str) -> Optional[Review]:
        """Get user's existing review for item"""
        # Find review by targetId, targetType and userId in userInfo
        reviews = await self.db.review.find_many(
            where={
                "targetId": item_id,
                "targetType": "item"
            }
        )
        
        # Filter by user_id in userInfo
        for review in reviews:
            if isinstance(review.userInfo, dict) and review.userInfo.get("id") == user_id:
                return review
        return None

    async def get_review_by_id(self, review_id: str) -> Optional[Review]:
        """Get review by ID"""
        return await self.db.review.find_unique(where={"id": review_id})

    async def get_item_reviews(self, item_id: str, skip: int = 0, limit: int = 20) -> list[Review]:
        """Get reviews for a item"""
        return await self.db.review.find_many(
            where={
                "targetId": item_id,
                "targetType": "item"
            },
            skip=skip,
            take=limit,
            order={"createdAt": "desc"}
        )
    
    async def count_reviews(self, item_id: str) -> int:
        """Count total reviews for a item"""
        return await self.db.review.count(
            where={
                "targetId": item_id,
                "targetType": "item"
            }
        )

    async def check_user_purchased_item(self, user_id: str, item_id: str) -> bool:
        """Check if user has successfully purchased the item"""
        order = await self.db.order.find_first(
            where={
                "buyerId": user_id,
                "itemId": item_id,
                "status": "paid"
            }
        )
        return order is not None

    async def create_review_with_transaction(
        self,
        item_id: str,
        user_id: str,
        user_info: dict,
        rating: int,
        comment: str = None
    ) -> tuple[Review, dict]:
        """
        flow:
        1. Create/update review
        2. Recalculate avg rating + total reviews
        3. Update item.avgRating + item.ratingCount
        If any step fails -> rollback all
        """
        async with self.db.tx() as tx:
            existing_review = await self.get_user_review(item_id=item_id, user_id=user_id)
            # Update or Create review
            if existing_review:
                review = await tx.review.update(
                    where={
                        "id": existing_review.id
                    },
                    data={
                        "rating": rating,
                        "comment": comment
                    }
                )
            else:
                review = await tx.review.create(
                    data={
                        "targetId": item_id,
                        "targetType": "item",
                        "userInfo": Json(user_info),
                        "rating": rating,
                        "comment": comment
                    }
                )

            # Recalculate item rating
            reviews = await tx.review.find_many(
                where={
                    "targetId": item_id,
                    "targetType": "item"
                }
            )
            if not reviews:
                avg_rating = 0.0
                rating_count = 0
            else:
                total_rating = sum(r.rating for r in reviews)
                rating_count = len(reviews)
                avg_rating = round(total_rating / rating_count, 2)

            # Update item rating fields
            await tx.shopitem.update(
                where={
                    "id": item_id
                },
                data={
                    "avgRating": avg_rating,
                    "ratingCount": rating_count
                }
            )

            return review, {
                "avg_rating": avg_rating,
                "rating_count": rating_count
            }
    
    async def delete_review_with_transaction(
        self,
        review_id: str,
    ) -> dict:
        """
        flow:
        1. Find existing review by ID
        2. Delete review
        3. Recalculate avg rating + total reviews
        4. Update item.avgRating + item.ratingCount
        If any step fails -> rollback all
        """
        existing_review = await self.get_review_by_id(review_id)
        if not existing_review:
            raise Exception("Review not found")
        
        item_id = existing_review.targetId
        
        async with self.db.tx() as tx:
            # Delete review
            await tx.review.delete(
                where={
                    "id": review_id
                }
            )
            # Recalculate item rating
            reviews = await tx.review.find_many(
                where={
                    "targetId": item_id,
                    "targetType": "item"
                }
            )

            if not reviews:
                avg_rating = 0.0
                rating_count = 0
            else:
                total_rating = sum(r.rating for r in reviews)
                rating_count = len(reviews)
                avg_rating = round(total_rating / rating_count, 2)

            # Update item rating fields
            await tx.shopitem.update(
                where={
                    "id": item_id
                },
                data={
                    "avgRating": avg_rating,
                    "ratingCount": rating_count
                }
            )

            return {
                "avg_rating": avg_rating,
                "rating_count": rating_count,
                "message": "Review deleted successfully"
            }
    # endregion

    
