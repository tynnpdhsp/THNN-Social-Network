const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

// Lấy danh sách danh mục địa điểm
export const getPlaceCategories = async () => {
  try {
    const response = await fetch(`${API_URL}/place/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return await response.json();
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

// Lấy danh sách địa điểm gần đây/theo bộ lọc
export const getNearbyPlaces = async (params = { lat: 10.762622, lng: 106.660172, radius: 10 }) => {
  try {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/place/${query ? `?${query}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch places');
    return await response.json();
  } catch (error) {
    console.error('Error fetching places:', error);
    throw error;
  }
};

// Lấy chi tiết địa điểm
export const getPlaceById = async (placeId) => {
  try {
    const response = await fetch(`${API_URL}/place/${placeId}`);
    if (!response.ok) throw new Error('Failed to fetch place details');
    return await response.json();
  } catch (error) {
    console.error('Error fetching place details:', error);
    throw error;
  }
};

// Tạo địa điểm mới
export const createPlace = async (data) => {
  try {
    const response = await fetch(`${API_URL}/place/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || 'dummy-token'}`
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail?.message || 'Failed to create place');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating place:', error);
    throw error;
  }
};

// Xóa địa điểm
export const deletePlace = async (placeId) => {
  try {
    const response = await fetch(`${API_URL}/place/${placeId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || 'dummy-token'}`
      }
    });
    if (!response.ok) throw new Error('Failed to delete place');
    return await response.json();
  } catch (error) {
    console.error('Error deleting place:', error);
    throw error;
  }
};

// Lấy danh sách nhận xét
export const getPlaceReviews = async (placeId, params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/place/${placeId}/reviews${query ? `?${query}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch reviews');
    return await response.json();
  } catch (error) {
    console.error('Error fetching reviews:', error);
    throw error;
  }
};

// Gửi nhận xét
export const createPlaceReview = async (placeId, data) => {
  try {
    const response = await fetch(`${API_URL}/place/${placeId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || 'dummy-token'}`
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

// Toggle Bookmark
export const togglePlaceBookmark = async (placeId) => {
  try {
    const response = await fetch(`${API_URL}/place/${placeId}/bookmark`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || 'dummy-token'}`
      }
    });
    if (!response.ok) throw new Error('Failed to toggle bookmark');
    return await response.json();
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    throw error;
  }
};

// Kiểm tra Bookmark
export const checkPlaceBookmark = async (placeId) => {
  try {
    const response = await fetch(`${API_URL}/place/${placeId}/bookmark`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || 'dummy-token'}`
      }
    });
    if (!response.ok) throw new Error('Failed to check bookmark');
    return await response.json();
  } catch (error) {
    console.error('Error checking bookmark:', error);
    throw error;
  }
};
// Tải lên hình ảnh cho địa điểm
export const uploadPlaceImages = async (placeId, files) => {
  try {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_URL}/place/${placeId}/images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || 'dummy-token'}`
      },
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload images');
    return await response.json();
  } catch (error) {
    console.error('Error uploading images:', error);
    throw error;
  }
};
