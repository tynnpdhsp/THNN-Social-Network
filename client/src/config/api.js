// =============================================================================
// API Configuration - THNN Social Network
// =============================================================================

export const API_BASE = 'http://localhost:8000/api/v1';
export const WS_BASE = 'ws://localhost:8000/api/v1';
export const MINIO_URL = 'http://localhost:9000';

/**
 * Helper: resolve image URL (handles both full URLs and MinIO relative paths)
 */
export function resolveImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return MINIO_URL + url;
}

/**
 * Helper: generate fallback avatar from name
 */
export function getDefaultAvatar(name) {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'U')}`;
}

/**
 * Authenticated fetch wrapper
 */
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser will set it with boundary)
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized — token expired
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.reload();
    throw new Error('Phiên đăng nhập đã hết hạn');
  }

  return res;
}
