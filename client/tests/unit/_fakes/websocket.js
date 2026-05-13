/**
 * Mock WebSocket for unit tests (Messaging, etc.).
 * Assign to global: `globalThis.WebSocket = MockWebSocket` in beforeEach, restore in afterEach.
 */
export class MockWebSocket {
  /** @type {MockWebSocket[]} */
  static instances = [];

  static reset() {
    MockWebSocket.instances = [];
  }

  /**
   * @param {string} url
   * @param {string|string[]} [protocols]
   */
  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    /** @type {0|1|2|3} */
    this.readyState = 0;
    /** @type {((ev: { data: string }) => void) | null} */
    this.onmessage = null;
    /** @type {((ev?: unknown) => void) | null} */
    this.onopen = null;
    /** @type {((ev?: unknown) => void) | null} */
    this.onerror = null;
    /** @type {((ev?: unknown) => void) | null} */
    this.onclose = null;
    /** @type {string[]} */
    this.sent = [];
    MockWebSocket.instances.push(this);
  }

  /**
   * @param {string} data
   */
  send(data) {
    this.sent.push(typeof data === 'string' ? data : String(data));
  }

  close(code, reason) {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }

  /** Test helper: simulate server push */
  simulateMessage(payload) {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.onmessage?.({ data });
  }

  /** Test helper: OPENED */
  simulateOpen() {
    this.readyState = 1;
    this.onopen?.({});
  }

  /** Test helper: ERROR */
  simulateError(err = new Error('ws error')) {
    this.onerror?.(err);
  }
}

/**
 * @returns {() => void} restore function
 */
export function installMockWebSocket() {
  const Original = globalThis.WebSocket;
  globalThis.WebSocket = MockWebSocket;
  MockWebSocket.reset();
  return () => {
    globalThis.WebSocket = Original;
  };
}
