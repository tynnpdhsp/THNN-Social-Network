import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockWebSocket, installMockWebSocket } from './websocket.js';

describe('MockWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.reset();
  });

  it('constructor_records_url_protocols_and_registers_instance', () => {
    const ws = new MockWebSocket('ws://h/ws', ['proto']);
    expect(ws.url).toBe('ws://h/ws');
    expect(ws.protocols).toEqual(['proto']);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]).toBe(ws);
  });

  it('constructor_without_protocols', () => {
    const ws = new MockWebSocket('ws://x');
    expect(ws.protocols).toBeUndefined();
  });

  it('send_appends_string_payloads', () => {
    const ws = new MockWebSocket('u');
    ws.send('a');
    ws.send('b');
    expect(ws.sent).toEqual(['a', 'b']);
  });

  it('send_coerces_non_string_to_string', () => {
    const ws = new MockWebSocket('u');
    ws.send(123);
    expect(ws.sent).toEqual(['123']);
  });

  it('simulateMessage_invokes_onmessage_with_object_serialized', () => {
    const ws = new MockWebSocket('u');
    const fn = vi.fn();
    ws.onmessage = fn;
    ws.simulateMessage({ type: 'ping' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0].data).toBe(JSON.stringify({ type: 'ping' }));
  });

  it('simulateMessage_passes_through_string', () => {
    const ws = new MockWebSocket('u');
    const fn = vi.fn();
    ws.onmessage = fn;
    ws.simulateMessage('raw');
    expect(fn.mock.calls[0][0].data).toBe('raw');
  });

  it('simulateOpen_invokes_onopen', () => {
    const ws = new MockWebSocket('u');
    const fn = vi.fn();
    ws.onopen = fn;
    ws.simulateOpen();
    expect(fn).toHaveBeenCalled();
    expect(ws.readyState).toBe(1);
  });

  it('simulateError_invokes_onerror', () => {
    const ws = new MockWebSocket('u');
    const fn = vi.fn();
    ws.onerror = fn;
    ws.simulateError(new Error('e'));
    expect(fn).toHaveBeenCalled();
  });

  it('close_sets_readyState_and_invokes_onclose', () => {
    const ws = new MockWebSocket('u');
    const fn = vi.fn();
    ws.onclose = fn;
    ws.close(1000, 'bye');
    expect(ws.readyState).toBe(3);
    expect(fn).toHaveBeenCalled();
  });

  it('reset_clears_static_instances', () => {
    new MockWebSocket('a');
    new MockWebSocket('b');
    expect(MockWebSocket.instances).toHaveLength(2);
    MockWebSocket.reset();
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('installMockWebSocket_patches_global_then_restore_returns_native', () => {
    const native = globalThis.WebSocket;
    const done = installMockWebSocket();
    expect(globalThis.WebSocket).toBe(MockWebSocket);
    const inst = new globalThis.WebSocket('ws://t');
    expect(inst).toBeInstanceOf(MockWebSocket);
    done();
    expect(globalThis.WebSocket).toBe(native);
  });
});
