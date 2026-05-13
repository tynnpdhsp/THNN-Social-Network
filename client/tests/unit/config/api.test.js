import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeResponse } from '../_fakes/fetch.js';

/** Fresh module after env stubs (Vitest + Vite `import.meta.env`). */
async function importApiFresh() {
  return import('@/config/api.js');
}

describe('config/api.js — constants via dynamic import (VITE_*)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('API_BASE_trims_trailing_slashes_from_VITE_API_BASE', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://localhost:8000/api/v1///');
    vi.stubEnv('VITE_WS_BASE', '');
    vi.resetModules();
    const { API_BASE } = await importApiFresh();
    expect(API_BASE).toBe('http://localhost:8000/api/v1');
  });

  it('WS_BASE_https_api_yields_wss_same_host_path', async () => {
    vi.stubEnv('VITE_API_BASE', 'https://api.example.com/api/v1');
    vi.stubEnv('VITE_WS_BASE', '');
    vi.resetModules();
    const { WS_BASE } = await importApiFresh();
    expect(WS_BASE).toBe('wss://api.example.com/api/v1');
  });

  it('WS_BASE_http_api_yields_ws_same_host_path', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://127.0.0.1:8000/api/v1');
    vi.stubEnv('VITE_WS_BASE', '');
    vi.resetModules();
    const { WS_BASE } = await importApiFresh();
    expect(WS_BASE).toBe('ws://127.0.0.1:8000/api/v1');
  });

  it('WS_BASE_relative_api_with_https_page_uses_wss_current_host', async () => {
    vi.stubEnv('VITE_API_BASE', '/api/v1');
    vi.stubEnv('VITE_WS_BASE', '');
    vi.resetModules();
    const prev = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...prev,
        protocol: 'https:',
        host: 'app.test:443',
        href: 'https://app.test/',
      },
    });
    try {
      const { WS_BASE } = await importApiFresh();
      expect(WS_BASE).toBe('wss://app.test:443/api/v1');
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: prev });
    }
  });

  it('WS_BASE_relative_api_with_http_page_uses_ws_current_host', async () => {
    vi.stubEnv('VITE_API_BASE', '/api/v1');
    vi.stubEnv('VITE_WS_BASE', '');
    vi.resetModules();
    const prev = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...prev,
        protocol: 'http:',
        host: 'localhost:5173',
        href: 'http://localhost:5173/',
      },
    });
    try {
      const { WS_BASE } = await importApiFresh();
      expect(WS_BASE).toBe('ws://localhost:5173/api/v1');
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: prev });
    }
  });

  it('VITE_WS_BASE_when_set_is_used_trimmed_not_inferred', async () => {
    vi.stubEnv('VITE_API_BASE', 'https://ignored.example/api/v1');
    vi.stubEnv('VITE_WS_BASE', 'wss://custom.example/ws///');
    vi.resetModules();
    const { WS_BASE } = await importApiFresh();
    expect(WS_BASE).toBe('wss://custom.example/ws');
  });

  it('WS_BASE_unknown_api_scheme_falls_back_to_default_ws_localhost', async () => {
    vi.stubEnv('VITE_API_BASE', 'ftp://files.example/api');
    vi.stubEnv('VITE_WS_BASE', '');
    vi.resetModules();
    const { WS_BASE } = await importApiFresh();
    expect(WS_BASE).toBe('ws://localhost:8000/api/v1');
  });

  it('MINIO_URL_trims_trailing_slashes', async () => {
    vi.stubEnv('VITE_MINIO_PUBLIC_URL', 'https://cdn.example/minio///');
    vi.resetModules();
    const { MINIO_URL, resolveImageUrl } = await importApiFresh();
    expect(MINIO_URL).toBe('https://cdn.example/minio');
    expect(resolveImageUrl('/k')).toBe('https://cdn.example/minio/k');
  });
});

describe('config/api.js — resolveImageUrl (static module)', () => {
  let resolveImageUrl;
  let MINIO_URL;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await importApiFresh();
    resolveImageUrl = mod.resolveImageUrl;
    MINIO_URL = mod.MINIO_URL;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('null_and_empty_string_return_null', () => {
    expect(resolveImageUrl(null)).toBeNull();
    expect(resolveImageUrl('')).toBeNull();
  });

  it('relative_path_prefix_slash_prefixes_MINIO_URL', () => {
    expect(resolveImageUrl('/bucket/key')).toBe(`${MINIO_URL}/bucket/key`);
  });

  it('relative_path_without_leading_slash_concatenates', () => {
    expect(resolveImageUrl('bucket/key')).toBe(`${MINIO_URL}bucket/key`);
  });

  it('absolute_https_non_minio_returns_unchanged', () => {
    expect(resolveImageUrl('https://cdn.example/img.png')).toBe('https://cdn.example/img.png');
  });

  it('absolute_http_non_minio_returns_unchanged', () => {
    expect(resolveImageUrl('http://images.example/a.jpg')).toBe('http://images.example/a.jpg');
  });

  it('docker_internal_minio_host_rewrites_to_MINIO_URL_pathname', () => {
    expect(resolveImageUrl('http://minio:9000/my-bucket/obj')).toBe(`${MINIO_URL}/my-bucket/obj`);
    expect(resolveImageUrl('https://social-minio:9000/x/y')).toBe(`${MINIO_URL}/x/y`);
  });

  it('invalid_absolute_URL_string_catch_returns_original_string', () => {
    const bad = 'https://%ZZZ';
    expect(resolveImageUrl(bad)).toBe(bad);
  });
});

describe('config/api.js — getDefaultAvatar (static module)', () => {
  let getDefaultAvatar;

  beforeEach(async () => {
    vi.resetModules();
    ({ getDefaultAvatar } = await importApiFresh());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('encodes_special_chars_space_question_unicode', () => {
    const u = getDefaultAvatar('A B?');
    expect(u).toContain(encodeURIComponent('A B?'));
    expect(u).toMatch(/^https:\/\/api\.dicebear\.com\/7\.x\/initials\/svg\?seed=/);
  });

  it('null_undefined_empty_use_seed_U', () => {
    expect(getDefaultAvatar(null)).toContain(encodeURIComponent('U'));
    expect(getDefaultAvatar(undefined)).toContain(encodeURIComponent('U'));
    expect(getDefaultAvatar('')).toContain(encodeURIComponent('U'));
  });

  it('ascii_name_roundtrips_in_seed_query', () => {
    expect(getDefaultAvatar('Alice')).toBe(
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent('Alice')}`,
    );
  });
});

describe('config/api.js — apiFetch', () => {
  let apiFetch;
  let API_BASE;
  let fetchSpy;

  beforeEach(async () => {
    vi.resetModules();
    ({ apiFetch, API_BASE } = await importApiFresh());
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(200, { ok: true }));
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('concatenates_API_BASE_and_path', async () => {
    await apiFetch('/account/me');
    expect(fetchSpy).toHaveBeenCalledWith(`${API_BASE}/account/me`, expect.any(Object));
  });

  it('no_token_omits_Authorization_header', async () => {
    await apiFetch('/x');
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('with_token_adds_Bearer_Authorization', async () => {
    localStorage.setItem('token', 'abc');
    await apiFetch('/x');
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer abc');
  });

  it('FormData_body_does_not_set_Content_Type', async () => {
    const fd = new FormData();
    fd.append('a', '1');
    await apiFetch('/up', { method: 'POST', body: fd });
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.body).toBe(fd);
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('JSON_object_body_sets_application_json_when_not_preset', async () => {
    await apiFetch('/x', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('caller_Content_Type_not_overridden_for_JSONish_body', async () => {
    await apiFetch('/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.api+json' },
      body: JSON.stringify({}),
    });
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/vnd.api+json');
  });

  it('FormData_with_explicit_Content_Type_keeps_caller_value', async () => {
    const fd = new FormData();
    await apiFetch('/x', {
      method: 'POST',
      body: fd,
      headers: { 'Content-Type': 'multipart/form-data; boundary=manual' },
    });
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('multipart/form-data; boundary=manual');
  });

  it('GET_without_body_still_adds_application_json_header_per_implementation', async () => {
    await apiFetch('/y');
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('passes_through_options_method_and_other_fields', async () => {
    await apiFetch('/z', { method: 'PATCH', cache: 'no-store' });
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.method).toBe('PATCH');
    expect(init.cache).toBe('no-store');
  });

  it('status_401_removes_token_calls_reload_throws_Vietnamese_error', async () => {
    localStorage.setItem('token', 'expired');
    fetchSpy.mockResolvedValueOnce(makeResponse(401, { detail: 'nope' }));
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

    await expect(apiFetch('/p')).rejects.toThrow('Phiên đăng nhập đã hết hạn');
    expect(localStorage.getItem('token')).toBeNull();
    expect(reloadSpy).toHaveBeenCalled();

    reloadSpy.mockRestore();
  });

  it('status_200_returns_response_object', async () => {
    const res = await apiFetch('/ok');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('propagates_fetch_rejection', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'));
    await expect(apiFetch('/a')).rejects.toThrow('network down');
  });
});
