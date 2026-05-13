// =============================================================================
// API Configuration - THNN Social Network
// Deploy: set VITE_API_BASE, VITE_WS_BASE, VITE_MINIO_PUBLIC_URL at build time.
// =============================================================================

function trimTrailingSlashes(s) {
  return s.replace(/\/+$/, '');
}

const defaultApi = 'http://localhost:8000/api/v1';
const rawApi = (import.meta.env.VITE_API_BASE || defaultApi).trim();
export const API_BASE = trimTrailingSlashes(rawApi);

function wsBaseFromApi(apiBase) {
  if (apiBase.startsWith('https://')) {
    return 'wss://' + apiBase.slice('https://'.length);
  }
  if (apiBase.startsWith('http://')) {
    return 'ws://' + apiBase.slice('http://'.length);
  }
  // Same-origin reverse proxy: /api/v1 → wss://current-host/api/v1
  if (apiBase.startsWith('/') && typeof window !== 'undefined') {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${window.location.host}${apiBase}`;
  }
  return 'ws://localhost:8000/api/v1';
}

const rawWs = (import.meta.env.VITE_WS_BASE || '').trim();
export const WS_BASE = trimTrailingSlashes(rawWs || wsBaseFromApi(API_BASE));

const defaultMinio = 'http://localhost:9000';
export const MINIO_URL = trimTrailingSlashes(
  (import.meta.env.VITE_MINIO_PUBLIC_URL || defaultMinio).trim()
);

/**
 * Helper: resolve image URL (handles both full URLs and MinIO relative paths)
 */
export function resolveImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Backward compatibility: rewrite Docker-internal MinIO URLs.
    try {
      const parsed = new URL(url);
      if (parsed.host === 'minio:9000' || parsed.host === 'social-minio:9000') {
        return MINIO_URL + parsed.pathname;
      }
    } catch {
      return url;
    }
    return url;
  }
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
