import { apiFetch } from '../config/api';

// Lấy danh sách tài liệu
export const getDocuments = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const response = await apiFetch(`/documents/${query ? `?${query}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch documents');
    return await response.json();
  } catch (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }
};

// Lấy danh mục tài liệu
export const getDocumentCategories = async () => {
  try {
    const response = await apiFetch('/documents/categories');
    if (!response.ok) throw new Error('Failed to fetch document categories');
    return await response.json();
  } catch (error) {
    console.error('Error fetching document categories:', error);
    throw error;
  }
};

// Tải lên tài liệu
export const uploadDocument = async (data) => {
  try {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    if (data.category_id) formData.append('category_id', data.category_id);

    const response = await apiFetch('/documents/', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail?.message || 'Failed to upload document');
    }
    return await response.json();
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
};

// Lấy chi tiết tài liệu
export const getDocumentById = async (documentId) => {
  try {
    const response = await apiFetch(`/documents/${documentId}`);
    if (!response.ok) throw new Error('Failed to fetch document detail');
    return await response.json();
  } catch (error) {
    console.error('Error fetching document detail:', error);
    throw error;
  }
};

// Lấy danh sách nhận xét của tài liệu
export const getDocumentReviews = async (documentId, params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const response = await apiFetch(`/documents/${documentId}/reviews${query ? `?${query}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch reviews');
    return await response.json();
  } catch (error) {
    console.error('Error fetching reviews:', error);
    throw error;
  }
};

// Đăng nhận xét cho tài liệu
export const createDocumentReview = async (documentId, data) => {
  try {
    const response = await apiFetch(`/documents/${documentId}/reviews`, {
      method: 'POST',
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

// Xoá tài liệu
export const deleteDocument = async (documentId) => {
  try {
    const response = await apiFetch(`/documents/${documentId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete document');
    return response;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

// Báo cáo tài liệu
export const reportDocument = async (documentId, data) => {
  try {
    const response = await apiFetch(`/social/reports/document/${documentId}?reason=${encodeURIComponent(data.reason)}`, {
      method: 'POST',
      body: JSON.stringify({ description: data.description }),
    });
    if (!response.ok) throw new Error('Failed to report document');
    return await response.json();
  } catch (error) {
    console.error('Error reporting document:', error);
    throw error;
  }
};
