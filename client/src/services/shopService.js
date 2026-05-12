import { apiFetch, API_BASE } from '../config/api';
const API_URL = API_BASE;

// Lấy danh sách sản phẩm
export const getItems = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/shop/items${query ? `?${query}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch items');
    return await response.json();
  } catch (error) {
    console.error('Error fetching items:', error);
    throw error;
  }
};

// Lấy danh mục
export const getCategories = async () => {
  try {
    const response = await fetch(`${API_URL}/shop/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return await response.json();
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

// Tải ảnh lên
export const uploadItemImages = async (files) => {
  try {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    const response = await fetch(`${API_URL}/shop/items/upload-images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData,
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail?.message || 'Failed to upload images');
    }
    return await response.json();
  } catch (error) {
    console.error('Error uploading images:', error);
    throw error;
  }
};

// Tạo sản phẩm mới
export const createItem = async (data) => {
  try {
    const response = await fetch(`${API_URL}/shop/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail?.message || 'Failed to create item');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating item:', error);
    throw error;
  }
};

// Tạo đơn hàng mới
export const createOrder = async (data) => {
  try {
    const response = await fetch(`${API_URL}/shop/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail?.message || 'Failed to create order');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};

// Tạo URL thanh toán VNPAY
export const createVNPayUrl = async (data) => {
  try {
    const response = await fetch(`${API_URL}/shop/vnpay/create-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail?.message || 'Failed to create VNPay URL');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating VNPay URL:', error);
    throw error;
  }
};



// Cập nhật sản phẩm
export const updateItem = async (itemId, data) => {
  try {
    const response = await fetch(`${API_URL}/shop/items/${itemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail?.message || 'Failed to update item');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating item:', error);
    throw error;
  }
};

// Xoá sản phẩm
export const deleteItem = async (itemId) => {
  try {
    const response = await fetch(`${API_URL}/shop/items/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail?.message || 'Failed to delete item');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
};

// Lấy danh sách nhận xét
export const getReviews = async (itemId, params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/shop/items/${itemId}/reviews${query ? `?${query}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch reviews');
    return await response.json();
  } catch (error) {
    console.error('Error fetching reviews:', error);
    throw error;
  }
};

// Đăng nhận xét
export const createReview = async (itemId, data) => {
  try {
    const response = await fetch(`${API_URL}/shop/items/${itemId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail?.message || 'Failed to create review');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating review:', error);
    throw error;
  }
};

// Cart API functions
export const getCart = async () => {
  try {
    const response = await fetch(`${API_URL}/shop/cart`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to fetch cart');
    return await response.json();
  } catch (error) {
    console.error('Error fetching cart:', error);
    throw error;
  }
};

export const addToCart = async (itemId, quantity = 1) => {
  try {
    const response = await fetch(`${API_URL}/shop/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ item_id: itemId, quantity }),
    });
    if (!response.ok) throw new Error('Failed to add to cart');
    return await response.json();
  } catch (error) {
    console.error('Error adding to cart:', error);
    throw error;
  }
};

export const updateCartItem = async (itemId, quantity) => {
  try {
    const response = await fetch(`${API_URL}/shop/cart/${itemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ quantity }),
    });
    if (!response.ok) throw new Error('Failed to update cart item');
    return await response.json();
  } catch (error) {
    console.error('Error updating cart item:', error);
    throw error;
  }
};

export const removeFromCart = async (itemId) => {
  try {
    const response = await fetch(`${API_URL}/shop/cart/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to remove from cart');
    return await response.json();
  } catch (error) {
    console.error('Error removing from cart:', error);
    throw error;
  }
};

export const clearCart = async () => {
  try {
    const response = await fetch(`${API_URL}/shop/cart`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to clear cart');
    return await response.json();
  } catch (error) {
    console.error('Error clearing cart:', error);
    throw error;
  }
};
