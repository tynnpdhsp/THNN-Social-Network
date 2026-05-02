import pytest
import json
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

from tests.conftest import auth_headers

BASE = "/api/v1/shop"


@pytest.mark.asyncio
async def test_get_all_categories(client: AsyncClient):
    """Test getting all categories"""
    resp = await client.get(f"{BASE}/categories")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_create_category_success(client: AsyncClient, registered_user: dict):
    """Test creating a new category successfully"""
    category_data = {
        "name": "Test Category",
        "description": "A test category for unit testing"
    }
    
    resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == category_data["name"]
    assert data["description"] == category_data["description"]
    assert "id" in data
    assert "createdAt" in data


@pytest.mark.asyncio
async def test_create_category_duplicate_name(client: AsyncClient, registered_user: dict):
    """Test creating a category with duplicate name should fail"""
    category_data = {
        "name": "Duplicate Category",
        "description": "First category"
    }
    
    # Create first category
    resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 200
    
    # Try to create duplicate
    resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_get_category_by_id_success(client: AsyncClient, registered_user: dict):
    """Test getting category by ID successfully"""
    # First create a category
    category_data = {
        "name": "Get By ID Category",
        "description": "Category for ID test"
    }
    
    create_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    assert create_resp.status_code == 200
    category_id = create_resp.json()["id"]
    
    # Get category by ID
    resp = await client.get(f"{BASE}/categories/{category_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == category_id
    assert data["name"] == category_data["name"]


@pytest.mark.asyncio
async def test_get_category_by_id_not_found(client: AsyncClient):
    """Test getting non-existent category"""
    fake_id = "non-existent-id"
    resp = await client.get(f"{BASE}/categories/{fake_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_item_success(client: AsyncClient, registered_user: dict):
    """Test creating a new item successfully"""
    # First create a category
    category_data = {
        "name": "Item Category",
        "description": "Category for items"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create item
    item_data = {
        "category_id": category_id,
        "title": "Test Item",
        "description": "A test item for sale",
        "price": 99.99
    }
    
    resp = await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == item_data["title"]
    assert data["description"] == item_data["description"]
    assert data["price"] == item_data["price"]
    assert data["category_id"] == category_id
    assert data["seller_id"]  # Should be populated
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_create_item_invalid_category(client: AsyncClient, registered_user: dict):
    """Test creating item with invalid category ID"""
    item_data = {
        "category_id": "invalid-category-id",
        "title": "Test Item",
        "description": "A test item for sale",
        "price": 99.99
    }
    
    resp = await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_item_by_id_success(client: AsyncClient, registered_user: dict):
    """Test getting item by ID successfully"""
    # Create category first
    category_data = {
        "name": "Get Item Category",
        "description": "Category for getting item"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create item
    item_data = {
        "category_id": category_id,
        "title": "Get Test Item",
        "description": "Item to be retrieved",
        "price": 149.99
    }
    
    item_resp = await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    item_id = item_resp.json()["id"]
    
    # Get item by ID
    resp = await client.get(f"{BASE}/items/{item_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == item_id
    assert data["title"] == item_data["title"]


@pytest.mark.asyncio
async def test_get_item_by_id_not_found(client: AsyncClient):
    """Test getting non-existent item"""
    fake_id = "non-existent-item-id"
    resp = await client.get(f"{BASE}/items/{fake_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_item_success(client: AsyncClient, registered_user: dict):
    """Test updating item successfully"""
    # Create category
    category_data = {
        "name": "Update Item Category",
        "description": "Category for updating item"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create item
    item_data = {
        "category_id": category_id,
        "title": "Original Title",
        "description": "Original description",
        "price": 99.99
    }
    
    item_resp = await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    item_id = item_resp.json()["id"]
    
    # Update item
    update_data = {
        "title": "Updated Title",
        "price": 199.99
    }
    
    resp = await client.put(
        f"{BASE}/items/{item_id}",
        json=update_data,
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == update_data["title"]
    assert data["price"] == update_data["price"]
    assert data["description"] == item_data["description"]  # Should remain unchanged


@pytest.mark.asyncio
async def test_update_item_unauthorized(client: AsyncClient, registered_user: dict):
    """Test updating item by non-owner should fail"""
    # Create category
    category_data = {
        "name": "Auth Test Category",
        "description": "Category for auth test"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create item with first user
    item_data = {
        "category_id": category_id,
        "title": "Owner Item",
        "description": "Item owned by first user",
        "price": 99.99
    }
    
    item_resp = await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    item_id = item_resp.json()["id"]
    
    # Create another user
    from tests.conftest import _mock_redis
    second_user_email = "second_user@example.com"
    second_user_password = "TestPass123!"
    otp_code = "123456"
    
    otp_data = json.dumps({"code": otp_code, "attempts": 0, "max_attempts": 3})
    _mock_redis.data[f"auth:otp:{second_user_email}:register"] = otp_data
    
    # Register second user
    reg_resp = await client.post("/api/v1/account/register", json={
        "email": second_user_email,
        "password": second_user_password,
        "confirm_password": second_user_password,
        "full_name": "Second User",
        "phone_number": "0901234568",
        "code": otp_code
    })
    
    # If already registered, login
    if reg_resp.status_code == 409:
        reg_resp = await client.post("/api/v1/account/login", json={
            "email": second_user_email,
            "password": second_user_password,
        })
    
    second_user_token = reg_resp.json().get("access_token", "")
    
    # Try to update item with second user (should fail)
    update_data = {
        "title": "Hijacked Title"
    }
    
    resp = await client.put(
        f"{BASE}/items/{item_id}",
        json=update_data,
        headers=auth_headers(second_user_token)
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_item_success(client: AsyncClient, registered_user: dict):
    """Test deleting item successfully"""
    # Create category
    category_data = {
        "name": "Delete Item Category",
        "description": "Category for deleting item"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create item
    item_data = {
        "category_id": category_id,
        "title": "Item to Delete",
        "description": "This item will be deleted",
        "price": 99.99
    }
    
    item_resp = await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    item_id = item_resp.json()["id"]
    
    # Delete item
    resp = await client.delete(
        f"{BASE}/items/{item_id}",
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "message" in data
    
    # Verify item is deleted
    get_resp = await client.get(f"{BASE}/items/{item_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_search_items(client: AsyncClient, registered_user: dict):
    """Test searching items"""
    # Create category
    category_data = {
        "name": "Search Category",
        "description": "Category for search test"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create multiple items
    items = [
        {
            "category_id": category_id,
            "title": "Laptop Computer",
            "description": "A powerful laptop for work",
            "price": 999.99
        },
        {
            "category_id": category_id,
            "title": "Computer Mouse",
            "description": "Ergonomic mouse for computer",
            "price": 29.99
        },
        {
            "category_id": category_id,
            "title": "Keyboard",
            "description": "Mechanical keyboard",
            "price": 79.99
        }
    ]
    
    for item in items:
        await client.post(
            f"{BASE}/items",
            json=item,
            headers=auth_headers(registered_user["access_token"])
        )
    
    # Search for "computer"
    resp = await client.get(f"{BASE}/items?q=computer")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) >= 2  # Should find laptop and mouse
    
    # Search for "keyboard"
    resp = await client.get(f"{BASE}/items?q=keyboard")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) >= 1


@pytest.mark.asyncio
async def test_get_items_by_category(client: AsyncClient, registered_user: dict):
    """Test getting items by category"""
    # Create category
    category_data = {
        "name": "Filter Category",
        "description": "Category for filter test"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create items in this category
    item_data = {
        "category_id": category_id,
        "title": "Category Item",
        "description": "Item in specific category",
        "price": 49.99
    }
    
    await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    
    # Get items by category
    resp = await client.get(f"{BASE}/items?category_id={category_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert len(data["items"]) >= 1
    assert data["items"][0]["category_id"] == category_id


@pytest.mark.asyncio
async def test_get_my_items(client: AsyncClient, registered_user: dict):
    """Test getting current user's items"""
    # Create category
    category_data = {
        "name": "My Items Category",
        "description": "Category for my items"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create item
    item_data = {
        "category_id": category_id,
        "title": "My Item",
        "description": "Item belonging to me",
        "price": 199.99
    }
    
    await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    
    # Get my items
    resp = await client.get(
        f"{BASE}/my-items",
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert len(data["items"]) >= 1


@pytest.mark.asyncio
async def test_create_order_success(client: AsyncClient, registered_user: dict):
    """Test creating an order successfully"""
    # Create category
    category_data = {
        "name": "Order Category",
        "description": "Category for order test"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create item
    item_data = {
        "category_id": category_id,
        "title": "Item for Order",
        "description": "Item that will be ordered",
        "price": 299.99
    }
    
    item_resp = await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    item_id = item_resp.json()["id"]
    
    # Create order
    order_data = {
        "item_id": item_id,
        "payment_method": "vnpay"
    }
    
    resp = await client.post(
        f"{BASE}/orders",
        json=order_data,
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["item_id"] == item_id
    assert data["buyer_id"]  # Should be populated
    assert data["seller_id"]  # Should be populated
    assert data["amount"] == item_data["price"]
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_create_order_own_item(client: AsyncClient, registered_user: dict):
    """Test creating order for own item should fail"""
    # Create category
    category_data = {
        "name": "Own Item Category",
        "description": "Category for own item test"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create item
    item_data = {
        "category_id": category_id,
        "title": "My Own Item",
        "description": "Trying to buy my own item",
        "price": 199.99
    }
    
    item_resp = await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    item_id = item_resp.json()["id"]
    
    # Try to create order for own item
    order_data = {
        "item_id": item_id,
        "payment_method": "vnpay"
    }
    
    resp = await client.post(
        f"{BASE}/orders",
        json=order_data,
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_my_buyer_orders(client: AsyncClient, registered_user: dict):
    """Test getting buyer's orders"""
    # Create category
    category_data = {
        "name": " Buyer Order Category",
        "description": "Category for buyer order test"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create item
    item_data = {
        "category_id": category_id,
        "title": "Buyer Order Item",
        "description": "Item for buyer order",
        "price": 399.99
    }
    
    item_resp = await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    item_id = item_resp.json()["id"]
    
    # Create order
    order_data = {
        "item_id": item_id,
        "payment_method": "vnpay"
    }
    
    await client.post(
        f"{BASE}/orders",
        json=order_data,
        headers=auth_headers(registered_user["access_token"])
    )
    
    # Get buyer orders
    resp = await client.get(
        f"{BASE}/my-orders/buyer",
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "orders" in data
    assert len(data["orders"]) >= 1


@pytest.mark.asyncio
async def test_create_vnpay_payment(client: AsyncClient, registered_user: dict):
    """Test creating VNPay payment"""
    # Create category
    category_data = {
        "name": "Payment Category",
        "description": "Category for payment test"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create item
    item_data = {
        "category_id": category_id,
        "title": "Payment Item",
        "description": "Item for payment test",
        "price": 599.99
    }
    
    item_resp = await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    item_id = item_resp.json()["id"]
    
    # Create order
    order_data = {
        "item_id": item_id,
        "payment_method": "vnpay"
    }
    
    order_resp = await client.post(
        f"{BASE}/orders",
        json=order_data,
        headers=auth_headers(registered_user["access_token"])
    )
    order_id = order_resp.json()["id"]
    
    # Create VNPay payment
    payment_data = {
        "order_id": order_id,
        "amount": item_data["price"],
        "return_url": "http://localhost:3000/payment/return"
    }
    
    resp = await client.post(
        f"{BASE}/payments/vnpay/create",
        json=payment_data,
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "payment_url" in data
    assert "txn_ref" in data
    assert data["payment_url"].startswith("https://sandbox.vnpayment.vn")


@pytest.mark.asyncio
async def test_vnpay_callback_success(client: AsyncClient):
    """Test VNPay callback for successful payment"""
    # Mock callback data for successful payment
    callback_data = {
        "vnp_TxnRef": "test_order_123456789",
        "vnp_ResponseCode": "00",
        "vnp_TransactionStatus": "00"
    }
    
    # This would normally be called by VNPay server
    # For testing, we'll mock the order existence
    with patch('app.modules.shop.repository.ShopRepository.get_order_by_vnpay_ref') as mock_get_order:
        # Mock order
        mock_order = AsyncMock()
        mock_order.id = "test_order_id"
        mock_order.itemId = "test_item_id"
        
        mock_get_order.return_value = mock_order
        
        with patch('app.modules.shop.repository.ShopRepository.update_order') as mock_update_order, \
             patch('app.modules.shop.repository.ShopRepository.update_item') as mock_update_item:
            
            mock_update_order.return_value = mock_order
            mock_update_item.return_value = AsyncMock()
            
            resp = await client.post(f"{BASE}/payments/vnpay/callback", json=callback_data)
            assert resp.status_code == 200
            data = resp.json()
            assert "message" in data


@pytest.mark.asyncio
async def test_rate_item_success(client: AsyncClient, registered_user: dict):
    """Test rating an item"""
    # Create category
    category_data = {
        "name": "Rating Category",
        "description": "Category for rating test"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create item
    item_data = {
        "category_id": category_id,
        "title": "Rate This Item",
        "description": "Item to be rated",
        "price": 99.99
    }
    
    item_resp = await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    item_id = item_resp.json()["id"]
    
    # Rate item
    resp = await client.post(
        f"{BASE}/items/{item_id}/rate?rating=5",
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "message" in data


@pytest.mark.asyncio
async def test_rate_item_invalid_rating(client: AsyncClient, registered_user: dict):
    """Test rating item with invalid rating value"""
    # Create category
    category_data = {
        "name": "Invalid Rating Category",
        "description": "Category for invalid rating test"
    }
    
    cat_resp = await client.post(
        f"{BASE}/categories",
        json=category_data,
        headers=auth_headers(registered_user["access_token"])
    )
    category_id = cat_resp.json()["id"]
    
    # Create item
    item_data = {
        "category_id": category_id,
        "title": "Invalid Rating Item",
        "description": "Item for invalid rating test",
        "price": 99.99
    }
    
    item_resp = await client.post(
        f"{BASE}/items",
        json=item_data,
        headers=auth_headers(registered_user["access_token"])
    )
    item_id = item_resp.json()["id"]
    
    # Try to rate with invalid value (6 - out of range)
    resp = await client.post(
        f"{BASE}/items/{item_id}/rate?rating=6",
        headers=auth_headers(registered_user["access_token"])
    )
    assert resp.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_get_seller_stats(client: AsyncClient, registered_user: dict):
    """Test getting seller statistics"""
    # Get seller stats for current user
    resp = await client.get(f"{BASE}/seller-stats/{registered_user['email']}")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)


@pytest.mark.asyncio
async def test_unauthorized_access(client: AsyncClient):
    """Test that protected endpoints require authentication"""
    # Try to create category without auth
    category_data = {
        "name": "Unauthorized Category",
        "description": "Should fail without auth"
    }
    
    resp = await client.post(f"{BASE}/categories", json=category_data)
    assert resp.status_code == 401
    
    # Try to create item without auth
    item_data = {
        "category_id": "some-id",
        "title": "Unauthorized Item",
        "description": "Should fail without auth",
        "price": 99.99
    }
    
    resp = await client.post(f"{BASE}/items", json=item_data)
    assert resp.status_code == 401
    
    # Try to get my items without auth
    resp = await client.get(f"{BASE}/my-items")
    assert resp.status_code == 401