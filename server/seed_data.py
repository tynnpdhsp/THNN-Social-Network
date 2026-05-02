"""
Seed data script for MongoDB via Prisma
Run this script to populate database with sample data for testing
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from prisma import Prisma
from prisma.models import Role, User, ItemCategory, ShopItem, ItemImage, Order
from prisma.types import (
    UserCreateInput,
    ItemCategoryCreateInput,
    ShopItemCreateInput,
    ItemImageCreateInput,
    OrderCreateInput,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SeedData:
    def __init__(self):
        self.db = Prisma()
        
    async def connect(self):
        await self.db.connect()
        logger.info("Connected to database")
        
    async def disconnect(self):
        await self.db.disconnect()
        logger.info("Disconnected from database")
        
    async def clear_all_data(self):
        """Clear all existing data (careful in production!)"""
        logger.info("Clearing existing data...")
        await self.db.order.delete_many()
        await self.db.itemimage.delete_many()
        await self.db.shopitem.delete_many()
        await self.db.itemcategory.delete_many()
        await self.db.user.delete_many()
        await self.db.role.delete_many()
        logger.info("Data cleared")
        
    async def seed_roles(self):
        """Create roles"""
        logger.info("Seeding roles...")
        
        roles_data = [
            {"role": "student"},
            {"role": "admin"}
        ]
        
        created_roles = []
        for role_data in roles_data:
            role = await self.db.role.create(data=role_data)
            created_roles.append(role)
            logger.info(f"Created role: {role.role}")
            
        return created_roles
        
    async def seed_users(self, roles: list[Role]):
        """Create sample users"""
        logger.info("Seeding users...")
        
        # Get student role
        student_role = next(r for r in roles if r.role == "student")
        admin_role = next(r for r in roles if r.role == "admin")
        
        users_data = [
            {
                "email": "student1@example.com",
                "phoneNumber": "0912345678",
                "passwordHash": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6QJw/2Ej7W", # password123
                "fullName": "Nguyễn Văn An",
                "bio": "Sinh viên năm 3 CNTT",
                "avatarUrl": "https://picsum.photos/seed/user1/200/200.jpg",
                "roleId": student_role.id,
                "emailVerified": True
            },
            {
                "email": "student2@example.com",
                "phoneNumber": "0923456789",
                "passwordHash": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6QJw/2Ej7W",
                "fullName": "Trần Thị Bình",
                "bio": "Sinh viên năm 2 QTKD",
                "avatarUrl": "https://picsum.photos/seed/user2/200/200.jpg",
                "roleId": student_role.id,
                "emailVerified": True
            },
            {
                "email": "student3@example.com",
                "phoneNumber": "0934567890",
                "passwordHash": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6QJw/2Ej7W",
                "fullName": "Lê Văn Cường",
                "bio": "Sinh viên năm 4 KTĐT",
                "avatarUrl": "https://picsum.photos/seed/user3/200/200.jpg",
                "roleId": student_role.id,
                "emailVerified": True
            },
            {
                "email": "admin@example.com",
                "phoneNumber": "0945678901",
                "passwordHash": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6QJw/2Ej7W",
                "fullName": "Admin System",
                "bio": "Quản trị viên hệ thống",
                "avatarUrl": "https://picsum.photos/seed/admin/200/200.jpg",
                "roleId": admin_role.id,
                "emailVerified": True
            }
        ]
        
        created_users = []
        for user_data in users_data:
            user = await self.db.user.create(data=user_data)
            created_users.append(user)
            logger.info(f"Created user: {user.fullName} ({user.email})")
            
        return created_users
        
    async def seed_categories(self):
        """Create item categories"""
        logger.info("Seeding categories...")
        
        categories_data = [
            {
                "name": "Sách giáo trình",
                "description": "Sách giáo trình, tài liệu học tập các môn học"
            },
            {
                "name": "Đồ dùng học tập",
                "description": "Bút, thước, vở, và các đồ dùng học tập khác"
            },
            {
                "name": "Thiết bị điện tử",
                "description": "USB, tai nghe, sạc dự phòng và các thiết bị công nghệ"
            },
            {
                "name": "Quần áo",
                "description": "Đồng phục, quần áo sinh viên các loại"
            },
            {
                "name": "Khác",
                "description": "Các vật dụng khác"
            }
        ]
        
        created_categories = []
        for cat_data in categories_data:
            category = await self.db.itemcategory.create(data=cat_data)
            created_categories.append(category)
            logger.info(f"Created category: {category.name}")
            
        return created_categories
        
    async def seed_shop_items(self, users: list[User], categories: list[ItemCategory]):
        """Create sample shop items"""
        logger.info("Seeding shop items...")
        
        items_data = [
            {
                "sellerId": users[0].id,  # student1
                "categoryId": categories[0].id,  # Sách giáo trình
                "title": "Giáo trình Cấu trúc dữ liệu và giải thuật",
                "description": "Sách giáo trình CTDL&GT môn học kỳ 2, tình trạng 90%, giá gốc 150k",
                "price": 75000.0,
                "avgRating": 4.5,
                "ratingCount": 12
            },
            {
                "sellerId": users[0].id,
                "categoryId": categories[1].id,  # Đồ dùng học tập
                "title": "Bộ bút gel Pilot 5 màu",
                "description": "Bộ bút gel Pilot 5 màu, mới dùng 2 cây, còn rất mới",
                "price": 25000.0,
                "avgRating": 4.0,
                "ratingCount": 8
            },
            {
                "sellerId": users[1].id,  # student2
                "categoryId": categories[2].id,  # Thiết bị điện tử
                "title": "USB 32GB SanDisk Ultra",
                "description": "USB 32GB SanDisk Ultra, tốc độ đọc 100MB/s, mới 3 tháng",
                "price": 120000.0,
                "avgRating": 4.8,
                "ratingCount": 15
            },
            {
                "sellerId": users[1].id,
                "categoryId": categories[3].id,  # Quần áo
                "title": "Đồng phục sinh viên UIT",
                "description": "Áo đồng phục sinh viên UIT size M, mặc 2 lần, còn mới",
                "price": 80000.0,
                "avgRating": 3.5,
                "ratingCount": 6
            },
            {
                "sellerId": users[2].id,  # student3
                "categoryId": categories[0].id,  # Sách giáo trình
                "title": "Sách Lập trình hướng đối tượng Java",
                "description": "Sách Lập trình HĐT Java NXB Bưu điện, tình trạng 85%",
                "price": 45000.0,
                "avgRating": 4.2,
                "ratingCount": 10
            },
            {
                "sellerId": users[2].id,
                "categoryId": categories[2].id,  # Thiết bị điện tử
                "title": "Tai nghe Bluetooth Xiaomi",
                "description": "Tai nghe Bluetooth Xiaomi Redmi AirDots, dùng 6 tháng, pin tốt",
                "price": 200000.0,
                "avgRating": 4.6,
                "ratingCount": 20
            },
            {
                "sellerId": users[0].id,
                "categoryId": categories[1].id,  # Đồ dùng học tập
                "title": "Vở Campus 200 trang",
                "description": "Vở Campus 200 trang, còn 3 cuốn mới nguyên seal",
                "price": 15000.0,
                "avgRating": 4.0,
                "ratingCount": 5
            },
            {
                "sellerId": users[1].id,
                "categoryId": categories[4].id,  # Khác
                "title": "Balo Targus",
                "description": "Balo Targus size lớn, đựng được laptop 15.6 inch, dùng 1 năm",
                "price": 150000.0,
                "avgRating": 4.7,
                "ratingCount": 18
            }
        ]
        
        created_items = []
        for item_data in items_data:
            item = await self.db.shopitem.create(data=item_data)
            created_items.append(item)
            logger.info(f"Created item: {item.title}")
            
        return created_items
        
    async def seed_item_images(self, items: list[ShopItem]):
        """Create sample item images"""
        logger.info("Seeding item images...")
        
        for i, item in enumerate(items):
            # Add 2-3 images per item
            for j in range(2):
                image_data = {
                    "itemId": item.id,
                    "imageUrl": f"https://picsum.photos/seed/item{item.id}_{j}/400/300.jpg",
                    "displayOrder": j
                }
                image = await self.db.itemimage.create(data=image_data)
                logger.info(f"Created image for item {item.title}: {image.imageUrl}")
                
    async def seed_orders(self, users: list[User], items: list[ShopItem]):
        """Create sample orders"""
        logger.info("Seeding orders...")
        
        orders_data = [
            {
                "buyerId": users[1].id,  # student2 buys from student1
                "itemId": items[0].id,   # Giáo trình CTDL
                "sellerId": items[0].sellerId,
                "amount": items[0].price,
                "status": "paid",
                "paymentMethod": "vnpay",
                "vnpayTxnRef": f"VNPAY_{items[0].id}_{int(datetime.now().timestamp())}",
                "vnpayResponseCode": "00",
                "paidAt": datetime.now(timezone.utc) - timedelta(days=2)
            },
            {
                "buyerId": users[2].id,  # student3 buys from student1
                "itemId": items[1].id,   # Bút gel Pilot
                "sellerId": items[1].sellerId,
                "amount": items[1].price,
                "status": "paid",
                "paymentMethod": "vnpay",
                "vnpayTxnRef": f"VNPAY_{items[1].id}_{int(datetime.now().timestamp())}",
                "vnpayResponseCode": "00",
                "paidAt": datetime.now(timezone.utc) - timedelta(days=1)
            },
            {
                "buyerId": users[0].id,  # student1 buys from student2
                "itemId": items[2].id,   # USB SanDisk
                "sellerId": items[2].sellerId,
                "amount": items[2].price,
                "status": "pending",
                "paymentMethod": "vnpay",
                "vnpayTxnRef": f"VNPAY_{items[2].id}_{int(datetime.now().timestamp())}"
            },
            {
                "buyerId": users[1].id,  # student2 buys from student3
                "itemId": items[4].id,   # Sách Java
                "sellerId": items[4].sellerId,
                "amount": items[4].price,
                "status": "failed",
                "paymentMethod": "vnpay",
                "vnpayTxnRef": f"VNPAY_{items[4].id}_{int(datetime.now().timestamp())}",
                "vnpayResponseCode": "24"
            }
        ]
        
        created_orders = []
        for order_data in orders_data:
            order = await self.db.order.create(data=order_data)
            created_orders.append(order)
            
            # Update item status for paid orders
            if order.status == "paid":
                await self.db.shopitem.update(
                    where={"id": order.itemId},
                    data={"status": "sold"}
                )
                logger.info(f"Updated item {order.itemId} status to sold")
                
            logger.info(f"Created order: {order.id} - {order.status}")
            
        return created_orders
        
    async def seed_all(self):
        """Run complete seeding process"""
        try:
            await self.connect()
            
            # Clear existing data
            await self.clear_all_data()
            
            # Seed in order
            roles = await self.seed_roles()
            users = await self.seed_users(roles)
            categories = await self.seed_categories()
            items = await self.seed_shop_items(users, categories)
            await self.seed_item_images(items)
            orders = await self.seed_orders(users, items)
            
            logger.info("✅ Seeding completed successfully!")
            logger.info(f"Created {len(roles)} roles")
            logger.info(f"Created {len(users)} users")
            logger.info(f"Created {len(categories)} categories")
            logger.info(f"Created {len(items)} shop items")
            logger.info(f"Created {len(orders)} orders")
            
            # Print sample credentials
            logger.info("\n📋 Sample Login Credentials:")
            logger.info("Email: student1@example.com | Password: password123")
            logger.info("Email: student2@example.com | Password: password123")
            logger.info("Email: student3@example.com | Password: password123")
            logger.info("Email: admin@example.com  | Password: password123")
            
        except Exception as e:
            logger.error(f"❌ Seeding failed: {e}")
            raise
        finally:
            await self.disconnect()

async def main():
    """Main entry point"""
    seeder = SeedData()
    await seeder.seed_all()

if __name__ == "__main__":
    asyncio.run(main())
