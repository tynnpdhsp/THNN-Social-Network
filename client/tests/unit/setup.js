/**
 * Global test setup — Sprint 0.
 * Runs before every test file (see vitest.config.js setupFiles).
 */
import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';

const originalCreateObjectURL =
  typeof URL.createObjectURL === 'function' ? URL.createObjectURL.bind(URL) : () => 'blob:native-fallback';
const originalRevokeObjectURL =
  typeof URL.revokeObjectURL === 'function' ? URL.revokeObjectURL.bind(URL) : () => {};

function stubMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function stubObservers() {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.ResizeObserver = class ResizeObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function stubUrlObjectUrls() {
  let seq = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock-${++seq}`);
  URL.revokeObjectURL = vi.fn();
}

function stubClipboard() {
  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    configurable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) },
  });
}

function stubScroll() {
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
}

function stubLocation() {
  try {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: 'http://localhost/',
        pathname: '/',
        search: '',
        hash: '',
        assign: vi.fn(),
        replace: vi.fn(),
        reload,
        toString: () => 'http://localhost/',
      },
    });
  } catch {
    if (window.location && typeof window.location.reload === 'function') {
      window.location.reload = vi.fn();
    }
  }
}

stubMatchMedia();
stubObservers();
stubUrlObjectUrls();
stubClipboard();
stubScroll();
stubLocation();

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  vi.useRealTimers();
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  stubUrlObjectUrls();
});
