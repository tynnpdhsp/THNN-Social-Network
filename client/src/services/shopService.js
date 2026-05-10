const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

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
        'Authorization': 'Bearer dummy-token' // Mock token cho backend
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
        'Authorization': 'Bearer dummy-token' // Mock token cho backend
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
        'Authorization': 'Bearer dummy-token'
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
        'Authorization': 'Bearer dummy-token'
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
        'Authorization': 'Bearer dummy-token'
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
        'Authorization': 'Bearer dummy-token'
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
        'Authorization': 'Bearer dummy-token'
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


