from typing import Optional, List
from prisma import Prisma
from prisma.models import ItemCategory, ShopItem, ItemImage, Order
from prisma.types import (
    ItemCategoryCreateInput,
    ItemCategoryUpdateInput,
    ShopItemCreateInput,
    ShopItemUpdateInput,
    ItemImageCreateInput,
    OrderCreateInput,
    OrderUpdateInput,
    ShopItemWhereInput,
)

class ShopRepository:
    def __init__(self, db: Prisma):
        self.db = db

    # ─── Category Operations ───────────────────────────────────────────────────

    async def get_category_by_id(self, category_id: str) -> Optional[ItemCategory]:
        return await self.db.itemcategory.find_unique(where={"id": category_id})

    async def get_category_by_name(self, name: str) -> Optional[ItemCategory]:
        return await self.db.itemcategory.find_unique(where={"name": name})

    async def get_all_categories(self) -> List[ItemCategory]:
        return await self.db.itemcategory.find_many(order={"createdAt": "asc"})

    async def create_category(self, data: ItemCategoryCreateInput) -> ItemCategory:
        return await self.db.itemcategory.create(data=data)

    async def update_category(self, category_id: str, data: ItemCategoryUpdateInput) -> ItemCategory:
        return await self.db.itemcategory.update(where={"id": category_id}, data=data)

    async def delete_category(self, category_id: str) -> ItemCategory:
        return await self.db.itemcategory.delete(where={"id": category_id})

    # ─── Item Operations ───────────────────────────────────────────────────────

    async def get_item_by_id(self, item_id: str) -> Optional[ShopItem]:
        return await self.db.shopitem.find_unique(
            where={"id": item_id},
            include={
                "category": True,
                "itemImages": {"order": {"displayOrder": "asc"}},
                "seller": {"select": {"id": True, "fullName": True, "avatarUrl": True}}
            }
        )

    async def get_items_by_seller(self, seller_id: str, skip: int = 0, limit: int = 20) -> List[ShopItem]:
        return await self.db.shopitem.find_many(
            where={"sellerId": seller_id, "deletedAt": None},
            include={"category": True, "itemImages": {"order": {"displayOrder": "asc"}}},
            order={"createdAt": "desc"},
            skip=skip,
            take=limit
        )

    async def get_items_by_category(self, category_id: str, skip: int = 0, limit: int = 20) -> List[ShopItem]:
        return await self.db.shopitem.find_many(
            where={"categoryId": category_id, "status": "active", "deletedAt": None},
            include={"category": True, "itemImages": {"order": {"displayOrder": "asc"}}},
            order={"createdAt": "desc"},
            skip=skip,
            take=limit
        )

    async def search_items(self, query: str, skip: int = 0, limit: int = 20) -> List[ShopItem]:
        where_clause: ShopItemWhereInput = {
            "deletedAt": None,
            "status": "active"
        }
        
        if query:
            where_clause["OR"] = [
                {"title": {"contains": query, "mode": "insensitive"}},
                {"description": {"contains": query, "mode": "insensitive"}}
            ]
        
        return await self.db.shopitem.find_many(
            where=where_clause,
            include={"category": True, "itemImages": {"order": {"displayOrder": "asc"}}},
            order={"createdAt": "desc"},
            skip=skip,
            take=limit
        )

    async def count_items(self, where_clause: Optional[ShopItemWhereInput] = None) -> int:
        if where_clause is None:
            where_clause = {"deletedAt": None, "status": "active"}
        return await self.db.shopitem.count(where=where_clause)

    async def create_item(self, data: ShopItemCreateInput) -> ShopItem:
        return await self.db.shopitem.create(
            data=data,
            include={"category": True}
        )

    async def update_item(self, item_id: str, data: ShopItemUpdateInput) -> ShopItem:
        return await self.db.shopitem.update(
            where={"id": item_id},
            data=data,
            include={"category": True, "itemImages": {"order": {"displayOrder": "asc"}}}
        )

    async def soft_delete_item(self, item_id: str) -> ShopItem:
        from datetime import datetime, timezone
        return await self.db.shopitem.update(
            where={"id": item_id},
            data={"deletedAt": datetime.now(timezone.utc)}
        )

    async def update_item_rating(self, item_id: str, new_rating: float, rating_count: int) -> ShopItem:
        return await self.db.shopitem.update(
            where={"id": item_id},
            data={"avgRating": new_rating, "ratingCount": rating_count}
        )

    # ─── Image Operations ───────────────────────────────────────────────────────

    async def get_images_by_item(self, item_id: str) -> List[ItemImage]:
        return await self.db.itemimage.find_many(
            where={"itemId": item_id},
            order={"displayOrder": "asc"}
        )

    async def create_image(self, data: ItemImageCreateInput) -> ItemImage:
        return await self.db.itemimage.create(data=data)

    async def update_image_order(self, image_id: str, display_order: int) -> ItemImage:
        return await self.db.itemimage.update(
            where={"id": image_id},
            data={"displayOrder": display_order}
        )

    async def delete_image(self, image_id: str) -> ItemImage:
        return await self.db.itemimage.delete(where={"id": image_id})

    async def delete_images_by_item(self, item_id: str) -> int:
        # Delete all images for an item
        result = await self.db.itemimage.delete_many(where={"itemId": item_id})
        return result.count

    # ─── Order Operations ───────────────────────────────────────────────────────

    async def get_order_by_id(self, order_id: str) -> Optional[Order]:
        return await self.db.order.find_unique(
            where={"id": order_id},
            include={
                "item": {
                    "include": {"category": True, "itemImages": {"take": 1}}
                },
                "buyer": {"select": {"id": True, "fullName": True, "email": True}},
                "seller": {"select": {"id": True, "fullName": True, "email": True}}
            }
        )

    async def get_orders_by_buyer(self, buyer_id: str, skip: int = 0, limit: int = 20) -> List[Order]:
        return await self.db.order.find_many(
            where={"buyerId": buyer_id},
            include={"item": {"include": {"category": True}}},
            order={"createdAt": "desc"},
            skip=skip,
            take=limit
        )

    async def get_orders_by_seller(self, seller_id: str, skip: int = 0, limit: int = 20) -> List[Order]:
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

    async def create_order(self, data: OrderCreateInput) -> Order:
        return await self.db.order.create(
            data=data,
            include={"item": {"include": {"category": True}}}
        )

    async def update_order(self, order_id: str, data: OrderUpdateInput) -> Order:
        return await self.db.order.update(
            where={"id": order_id},
            data=data,
            include={"item": {"include": {"category": True}}}
        )

    async def get_order_by_vnpay_ref(self, vnpay_txn_ref: str) -> Optional[Order]:
        return await self.db.order.find_unique(
            where={"vnpayTxnRef": vnpay_txn_ref},
            include={"item": True}
        )

    # ─── Analytics Operations ───────────────────────────────────────────────────

    async def get_seller_stats(self, seller_id: str) -> dict:
        # Get seller's shop statistics
        total_items = await self.db.shopitem.count(
            where={"sellerId": seller_id, "deletedAt": None}
        )
        active_items = await self.db.shopitem.count(
            where={"sellerId": seller_id, "status": "active", "deletedAt": None}
        )
        sold_items = await self.db.shopitem.count(
            where={"sellerId": seller_id, "status": "sold", "deletedAt": None}
        )
        total_orders = await self.db.order.count(
            where={"sellerId": seller_id, "status": "paid"}
        )
        
        return {
            "total_items": total_items,
            "active_items": active_items,
            "sold_items": sold_items,
            "total_orders": total_orders
        }