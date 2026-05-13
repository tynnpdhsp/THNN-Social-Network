import { apiFetch } from '../config/api';

export const getCurrentUser = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    return null;
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { id: payload.sub || payload.id, role: payload.role || 'user' };
  } catch (e) {
    return null;
  }
};

// Lấy danh sách danh mục địa điểm
export const getPlaceCategories = async () => {
  try {
    const response = await apiFetch(`/place/categories`);
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
    const response = await apiFetch(query ? `/place/?${query}` : '/place/');
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
    const response = await apiFetch(`/place/${placeId}`);
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
    const response = await apiFetch(`/place/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || 'Failed to create place');
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
    const response = await apiFetch(`/place/${placeId}`, {
      method: 'DELETE'
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
    const response = await apiFetch(`/place/${placeId}/reviews${query ? `?${query}` : ''}`);
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
    const response = await apiFetch(`/place/${placeId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || 'Failed to create review');
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
    const response = await apiFetch(`/place/${placeId}/bookmark`, {
      method: 'POST'
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
    const response = await apiFetch(`/place/${placeId}/bookmark`);
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

    const response = await apiFetch(`/place/${placeId}/images`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error('Failed to upload images');
    }
    return await response.json();
  } catch (error) {
    console.error('Error uploading images:', error);
    throw error;
  }
};
