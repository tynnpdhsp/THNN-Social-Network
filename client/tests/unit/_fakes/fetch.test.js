import { describe, it, expect, afterEach } from 'vitest';
import {
  makeResponse,
  requestKey,
  mockFetchByPath,
  mockFetchSequence,
  restoreFetch,
} from './fetch.js';

describe('makeResponse', () => {
  it('status_2xx_default_ok_true_and_json_roundtrip', async () => {
    const r = makeResponse(200, { a: 1 });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    await expect(r.json()).resolves.toEqual({ a: 1 });
  });

  it('status_4xx_default_ok_false', async () => {
    const r = makeResponse(404, { detail: 'nf' });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
  });

  it('options_ok_overrides_status_derived_ok', async () => {
    const r = makeResponse(500, {}, { ok: true });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(500);
  });

  it('options_ok_false_for_200', async () => {
    const r = makeResponse(200, {}, { ok: false });
    expect(r.ok).toBe(false);
  });

  it('jsonBody_async_function_is_awaited', async () => {
    const r = makeResponse(200, async () => ({ x: 2 }));
    await expect(r.json()).resolves.toEqual({ x: 2 });
  });

  it('jsonBody_null_returns_null', async () => {
    const r = makeResponse(204, null);
    await expect(r.json()).resolves.toBeNull();
  });

  it('jsonBody_undefined_returns_undefined', async () => {
    const r = makeResponse(200, undefined);
    await expect(r.json()).resolves.toBeUndefined();
  });

  it('text_uses_options_text_when_set', async () => {
    const r = makeResponse(200, { ignored: true }, { text: 'plain' });
    await expect(r.text()).resolves.toBe('plain');
  });

  it('text_serializes_object_when_no_options_text', async () => {
    const r = makeResponse(200, { k: 'v' });
    await expect(r.text()).resolves.toBe(JSON.stringify({ k: 'v' }));
  });

  it('text_empty_string_for_null_json_body_without_options_text', async () => {
    const r = makeResponse(200, null);
    await expect(r.text()).resolves.toBe('');
  });

  it('headers_are_exposed_on_response', () => {
    const r = makeResponse(200, {}, { headers: { 'X-Test': '1' } });
    expect(r.headers.get('X-Test')).toBe('1');
  });

  it('jsonBody_array_roundtrips', async () => {
    const r = makeResponse(200, [{ a: 1 }]);
    await expect(r.json()).resolves.toEqual([{ a: 1 }]);
  });

  it('jsonBody_primitive_number', async () => {
    const r = makeResponse(200, 42);
    await expect(r.json()).resolves.toBe(42);
  });
});

describe('requestKey', () => {
  it('GET_string_absolute_url_pathname_and_search', () => {
    expect(requestKey('http://localhost:8000/api/v1/account/me')).toBe('GET /api/v1/account/me');
  });

  it('POST_string_absolute_includes_query', () => {
    expect(requestKey('http://x/y?q=1', { method: 'post' })).toBe('POST /y?q=1');
  });

  it('GET_relative_resolved_against_localhost', () => {
    expect(requestKey('/api/v1/foo')).toBe('GET /api/v1/foo');
  });

  it('Request_object_method_and_url', () => {
    const req = new Request('https://api.example.com/v1/z', { method: 'PATCH' });
    expect(requestKey(req)).toBe('PATCH /v1/z');
  });

  it('init_method_overrides_Request_method', () => {
    const req = new Request('https://api.example.com/a', { method: 'GET' });
    expect(requestKey(req, { method: 'PUT' })).toBe('PUT /a');
  });

  it('GET_URL_object_input', () => {
    const u = new URL('https://ex.com/api/v2/items?page=2');
    expect(requestKey(u)).toBe('GET /api/v2/items?page=2');
  });

  it('POST_URL_object_with_init_method', () => {
    const u = new URL('https://ex.com/r');
    expect(requestKey(u, { method: 'POST' })).toBe('POST /r');
  });

  it('method_defaults_to_GET_when_omitted', () => {
    expect(requestKey('http://h/a')).toBe('GET /a');
  });

  it('init_method_uppercased', () => {
    expect(requestKey('http://h/b', { method: 'delete' })).toBe('DELETE /b');
  });
});

describe('mockFetchByPath', () => {
  afterEach(() => {
    restoreFetch();
  });

  it('matches_GET_path_and_returns_json', async () => {
    mockFetchByPath({
      'GET /api/v1/x': makeResponse(200, { id: 1 }),
    });
    const res = await fetch('http://localhost:8000/api/v1/x');
    expect(res.ok).toBe(true);
    await expect(res.json()).resolves.toEqual({ id: 1 });
  });

  it('matches_method_case_insensitive_in_init', async () => {
    mockFetchByPath({
      'POST /api/v1/x': makeResponse(201, { created: true }),
    });
    const res = await fetch('http://localhost:8000/api/v1/x', { method: 'post', body: '{}' });
    await expect(res.json()).resolves.toEqual({ created: true });
  });

  it('plain_object_wrapped_as_200_json', async () => {
    mockFetchByPath({
      'GET /a': { hello: 'world' },
    });
    const res = await fetch('http://localhost/a');
    await expect(res.json()).resolves.toEqual({ hello: 'world' });
  });

  it('numeric_handler_wraps_empty_object_body', async () => {
    mockFetchByPath({
      'GET /n': 418,
    });
    const res = await fetch('http://localhost/n');
    expect(res.status).toBe(418);
    expect(res.ok).toBe(false);
    await expect(res.json()).resolves.toEqual({});
  });

  it('function_handler_receives_input_and_init', async () => {
    mockFetchByPath({
      'GET /f': (input, init) =>
        makeResponse(200, {
          saw: input,
          method: init.method || 'GET',
          headerPresent: Boolean(init.headers),
        }),
    });
    const res = await fetch('http://localhost/f', { headers: { 'X-A': 'b' } });
    await expect(res.json()).resolves.toMatchObject({
      saw: 'http://localhost/f',
      method: 'GET',
      headerPresent: true,
    });
  });

  it('matches_fetch_with_URL_object_input', async () => {
    mockFetchByPath({
      'GET /api/items': makeResponse(200, { ok: true }),
    });
    const res = await fetch(new URL('http://localhost:8000/api/items'));
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('throws_with_helpful_message_when_no_handler', async () => {
    mockFetchByPath({
      'GET /known': makeResponse(200, {}),
    });
    await expect(fetch('http://localhost/unknown')).rejects.toThrow(/no handler for "GET \/unknown"/);
  });

  it('returns_raw_response_like_object_without_wrapping', async () => {
    const custom = makeResponse(202, { accepted: true });
    mockFetchByPath({
      'GET /raw': custom,
    });
    const res = await fetch('http://localhost/raw');
    expect(res.status).toBe(202);
  });
});

describe('mockFetchSequence', () => {
  afterEach(() => {
    restoreFetch();
  });

  it('consumes_handlers_in_order', async () => {
    const { fetchMock, getCallIndex } = mockFetchSequence([
      makeResponse(200, { step: 1 }),
      makeResponse(200, { step: 2 }),
      async () => makeResponse(200, { step: 3 }),
    ]);
    const r1 = await fetch('http://a/1');
    const r2 = await fetch('http://a/2');
    const r3 = await fetch('http://a/3');
    await expect(r1.json()).resolves.toEqual({ step: 1 });
    await expect(r2.json()).resolves.toEqual({ step: 2 });
    await expect(r3.json()).resolves.toEqual({ step: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getCallIndex()).toBe(3);
  });

  it('throws_when_exhausted', async () => {
    mockFetchSequence([makeResponse(200, {})]);
    await fetch('http://x');
    await expect(fetch('http://x')).rejects.toThrow(/exhausted/);
  });

  it('function_entry_can_inspect_each_call', async () => {
    const seen = [];
    mockFetchSequence([
      (input) => {
        seen.push(input);
        return makeResponse(200, { ok: true });
      },
    ]);
    await fetch('http://h1/z');
    expect(seen[0]).toBe('http://h1/z');
  });
});

describe('restoreFetch', () => {
  it('restores_native_fetch_after_mock', async () => {
    mockFetchByPath({ 'GET /z': makeResponse(200, {}) });
    await fetch('http://localhost/z');
    restoreFetch();
    expect(typeof globalThis.fetch).toBe('function');
  });
});
