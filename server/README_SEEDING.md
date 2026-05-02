# Database Seeding Guide

## Overview

This guide explains how to populate your MongoDB database with sample data for testing the Shop module and User management.

## Prerequisites

- MongoDB running (local or Atlas)
- Prisma client generated: `prisma generate`
- Python environment with dependencies installed

## Sample Data Structure

### 👥 **Users (4 accounts)**

| Email                  | Role    | Full Name     | Password      |
| ---------------------- | ------- | ------------- | ------------- |
| `student1@example.com` | student | Nguyễn Văn An | `password123` |
| `student2@example.com` | student | Trần Thị Bình | `password123` |
| `student3@example.com` | student | Lê Văn Cường  | `password123` |
| `admin@example.com`    | admin   | Admin System  | `password123` |

### 🏷️ **Categories (5 categories)**

1. **Sách giáo trình** - Textbooks and course materials
2. **Đồ dùng học tập** - Stationery and school supplies
3. **Thiết bị điện tử** - Electronics and gadgets
4. **Quần áo** - Clothing and uniforms
5. **Khác** - Miscellaneous items

### 🛍️ **Shop Items (8 items)**

Sample items across different categories:

- **Giáo trình Cấu trúc dữ liệu** - 75.000đ (Rating: 4.5/5)
- **Bộ bút gel Pilot** - 25.000đ (Rating: 4.0/5)
- **USB 32GB SanDisk** - 120.000đ (Rating: 4.8/5)
- **Đồng phục sinh viên UIT** - 80.000đ (Rating: 3.5/5)
- **Sách Lập trình Java** - 45.000đ (Rating: 4.2/5)
- **Tai nghe Bluetooth Xiaomi** - 200.000đ (Rating: 4.6/5)
- **Vở Campus 200 trang** - 15.000đ (Rating: 4.0/5)
- **Balo Targus** - 150.000đ (Rating: 4.7/5)

### 📦 **Orders (4 orders)**

Different order statuses:

- **Paid orders**: 2 (items marked as "sold")
- **Pending orders**: 1 (awaiting payment)
- **Failed orders**: 1 (payment failed)

## Running the Seeding Script

### Method 1: Direct Python

```bash
cd server
python seed_data.py
```

### Method 2: Using Python Module

```bash
cd server
python -m seed_data
```

### Method 3: From Python REPL

```python
import asyncio
from seed_data import SeedData

async def seed():
    seeder = SeedData()
    await seeder.seed_all()

asyncio.run(seed())
```

## What the Script Does

1. **Connect to Database** - Establish Prisma connection
2. **Clear Existing Data** - Remove all sample data (⚠️ **CAREFUL**)
3. **Seed Roles** - Create "student" and "admin" roles
4. **Seed Users** - Create 4 user accounts with hashed passwords
5. **Seed Categories** - Create 5 item categories
6. **Seed Shop Items** - Create 8 sample items with ratings
7. **Seed Images** - Add 2 sample images per item
8. **Seed Orders** - Create orders with different statuses
9. **Update Item Status** - Mark sold items appropriately

## Database Schema References

The script follows the Prisma schema structure:

```prisma
// Users
model User {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  email         String    @unique
  phoneNumber   String    @map("phone_number")
  passwordHash  String    @map("password_hash")
  fullName      String    @map("full_name")
  // ... other fields
  shopItems     ShopItem[]
  buyerOrders   Order[]   @relation("OrderBuyer")
  sellerOrders  Order[]   @relation("OrderSeller")
}

// Shop Items
model ShopItem {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  sellerId    String    @map("seller_id") @db.ObjectId
  categoryId  String    @map("category_id") @db.ObjectId
  title       String
  description String
  price       Float
  avgRating   Float     @default(0) @map("avg_rating")
  ratingCount Int       @default(0) @map("rating_count")
  status      String    @default("active")
  // ... relations
}

// Orders
model Order {
  id                String    @id @default(auto()) @map("_id") @db.ObjectId
  buyerId           String    @map("buyer_id") @db.ObjectId
  itemId            String    @map("item_id") @db.ObjectId
  sellerId          String    @map("seller_id") @db.ObjectId
  amount            Float
  status            String    @default("pending")
  paymentMethod     String    @default("vnpay")
  // ... payment fields
}
```

## Testing the Data

After seeding, you can test the API endpoints:

### Get All Categories

```bash
curl -X GET "http://localhost:8000/api/v1/shop/categories"
```

### Search Items

```bash
curl -X GET "http://localhost:8000/api/v1/shop/items?q=sách"
```

### Get User's Items

```bash
# First login to get token
curl -X POST "http://localhost:8000/api/v1/account/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=student1@example.com&password=password123"

# Then get items
curl -X GET "http://localhost:8000/api/v1/shop/my-items" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Purchase History

```bash
curl -X GET "http://localhost:8000/api/v1/shop/my-orders/buyer" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Customizing the Data

### Adding More Items

Edit the `seed_shop_items()` method in `seed_data.py`:

```python
items_data = [
    # ... existing items
    {
        "sellerId": users[0].id,
        "categoryId": categories[0].id,
        "title": "Your New Item",
        "description": "Item description",
        "price": 50000.0,
        "avgRating": 4.0,
        "ratingCount": 5
    }
]
```

### Changing Prices or Ratings

Simply modify the values in the `items_data` array.

### Adding More Users

Add to the `users_data` array in `seed_users()`.

## Important Notes

⚠️ **WARNING**: The script clears all existing data before seeding. Do not run in production!

🔐 **Passwords**: All accounts use the same password `password123` (hashed).

🖼️ **Images**: Uses placeholder images from Picsum Photos with unique seeds.

💰 **Prices**: All prices are in Vietnamese Dong (VND).

📊 **Ratings**: Items have realistic rating distributions (3.5-4.8/5).

## Troubleshooting

### Connection Issues

```bash
# Check MongoDB connection string in .env
MONGO_DATABASE_URL="mongodb://localhost:27017/thnn_social_network"
```

### Prisma Client Issues

```bash
# Regenerate Prisma client
prisma generate
```

### Permission Issues

```bash
# Make sure MongoDB user has read/write permissions
# For local MongoDB, default permissions should work
```

### Import Errors

```bash
# Install missing dependencies
pip install prisma
```

## Next Steps

After seeding:

1. Test the Shop API endpoints
2. Verify user authentication works
3. Test order creation and payment flow
4. Check image upload functionality
5. Test rating system

The sample data provides a realistic testing environment for all Shop module features!
