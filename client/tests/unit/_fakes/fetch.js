import { vi } from 'vitest';

const NATIVE_FETCH = globalThis.fetch;

/**
 * Build a Response-like object for mocking global fetch.
 *
 * @param {number} status HTTP status
 * @param {*} jsonBody Resolved value of .json() (object, array, async function returning value, or undefined)
 * @param {object} [options]
 * @param {string} [options.text] If set, .text() returns this string
 * @param {Record<string, string>} [options.headers] Flat header map
 * @param {boolean} [options.ok] Override ok (default: status in 200–299)
 */
export function makeResponse(status, jsonBody, options = {}) {
  const ok = options.ok !== undefined ? options.ok : status >= 200 && status < 300;
  const headersInit = options.headers || {};
  const headers = new Headers(headersInit);

  const jsonFn = async () => {
    if (typeof jsonBody === 'function') {
      return jsonBody();
    }
    return jsonBody;
  };

  const textFn = async () => {
    if (options.text !== undefined) return options.text;
    const j = await jsonFn();
    if (j === undefined || j === null) return '';
    return typeof j === 'string' ? j : JSON.stringify(j);
  };

  return {
    status,
    ok,
    headers,
    json: jsonFn,
    text: textFn,
    clone() {
      return makeResponse(status, jsonBody, options);
    },
  };
}

function getUrlString(input) {
  if (typeof input === 'string') return input;
  if (typeof URL !== 'undefined' && input instanceof URL) return input.href;
  return input.url;
}

/**
 * Normalize RequestInfo + RequestInit into "METHOD pathWithQuery" using URL pathname+search.
 * Works with absolute URLs and relative paths (relative resolved against http://localhost).
 */
export function requestKey(input, init = {}) {
  const urlString = getUrlString(input);
  const methodFromRequest =
    typeof Request !== 'undefined' && input instanceof Request ? input.method : null;
  /** `init.method` overrides Request.method (same as fetch()). */
  const method = (init.method || methodFromRequest || 'GET').toString().toUpperCase();
  const u = new URL(urlString, 'http://localhost');
  const path = u.pathname + u.search;
  return `${method} ${path}`;
}

/**
 * Map keyed by "METHOD /path?query" as returned by requestKey().
 * Value can be:
 * - Response-like from makeResponse
 * - plain object → auto-wrapped as makeResponse(200, value)
 * - function (input, init) => Response-like | Promise<Response-like>
 * - number → makeResponse(number, {}) empty object
 *
 * Unmatched requests: throws Error with attempted key (helps debugging).
 */
export function mockFetchByPath(pathMap) {
  const fetchMock = vi.fn(async (input, init = {}) => {
    const key = requestKey(input, init);
    const handler = pathMap[key];

    if (handler === undefined) {
      const tried = Object.keys(pathMap).join(', ') || '(empty map)';
      throw new Error(`mockFetchByPath: no handler for "${key}". Known keys: ${tried}`);
    }

    if (typeof handler === 'function') {
      return handler(input, init);
    }
    if (typeof handler === 'number') {
      return makeResponse(handler, {});
    }
    if (handler && typeof handler === 'object' && 'status' in handler && typeof handler.json === 'function') {
      return handler;
    }
    return makeResponse(200, handler);
  });

  globalThis.fetch = fetchMock;
  return fetchMock;
}

/**
 * Each fetch call consumes the next entry in order.
 * Entry can be:
 * - Response-like (has status + json)
 * - function (input, init) => response | Promise<response>
 * - plain object → makeResponse(200, entry)
 *
 * If list exhausted: throws.
 */
export function mockFetchSequence(sequence) {
  let index = 0;
  const fetchMock = vi.fn(async (input, init = {}) => {
    if (index >= sequence.length) {
      const url = typeof input === 'string' ? input : input?.url;
      throw new Error(`mockFetchSequence: exhausted after ${index} handler(s). Next fetch: ${url}`);
    }
    const entry = sequence[index++];

    if (typeof entry === 'function') {
      return entry(input, init);
    }
    if (entry && typeof entry === 'object' && 'status' in entry && typeof entry.json === 'function') {
      return entry;
    }
    return makeResponse(200, entry);
  });

  globalThis.fetch = fetchMock;
  return { fetchMock, getCallIndex: () => index };
}

/** Restore `globalThis.fetch` to the implementation captured at module load. */
export function restoreFetch() {
  globalThis.fetch = NATIVE_FETCH;
}
