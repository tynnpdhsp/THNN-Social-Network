import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { makeResponse } from '../../_fakes/fetch.js';
import { installMockWebSocket, MockWebSocket } from '../../_fakes/websocket.js';

const hoisted = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockApiFetch: vi.fn(),
  mockResolveImageUrl: vi.fn((u) => u || ''),
  mockGetDefaultAvatar: vi.fn((n) => `avatar:${n || 'U'}`),
}));

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => hoisted.mockUseAuth(),
}));

vi.mock('@/config/api.js', () => ({
  apiFetch: (...a) => hoisted.mockApiFetch(...a),
  WS_BASE: 'ws://unit.test/ws',
  resolveImageUrl: (u) => hoisted.mockResolveImageUrl(u),
  getDefaultAvatar: (n) => hoisted.mockGetDefaultAvatar(n),
}));

import Messaging from '@/components/Social/Messaging.jsx';

describe('Messaging — list & open chat', () => {
  let restoreWs;

  beforeEach(() => {
    restoreWs = installMockWebSocket();
    hoisted.mockUseAuth.mockReturnValue({
      user: { id: 'me', full_name: 'Me', avatar_url: null },
      token: 'jwt-token',
      onlineUsers: [],
    });
    hoisted.mockApiFetch.mockReset();
  });

  afterEach(() => {
    restoreWs();
    vi.clearAllMocks();
  });

  it('loadConversations_fetches_conversations_and_friends', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path) => {
      if (path === '/messaging/conversations') return makeResponse(200, { conversations: [] });
      if (path === '/social/friends') return makeResponse(200, []);
      return makeResponse(404, {});
    });
    render(<Messaging onViewProfile={vi.fn()} />);
    await waitFor(() => {
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/messaging/conversations');
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/friends');
    });
  });

  it('openChat_fetches_messages_and_POSTs_read', async () => {
    const conv = {
      id: 'c1',
      type: 'direct',
      other_member: { id: 'u2', full_name: 'Bob', avatar_url: null },
      last_message: { content: 'hey', created_at: '2026-01-01T12:00:00.000Z' },
      members: [{ user_id: 'me', last_read_at: '2025-12-01T00:00:00.000Z' }],
    };
    hoisted.mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/messaging/conversations') return makeResponse(200, { conversations: [conv] });
      if (path === '/social/friends') return makeResponse(200, []);
      if (path === '/messaging/conversations/c1/messages') return makeResponse(200, { messages: [{ id: 'm1', sender_id: 'u2', content: 'hey', created_at: '2026-01-01T12:00:00.000Z' }] });
      if (path === '/messaging/conversations/c1/read' && init?.method === 'POST') return makeResponse(200, {});
      return makeResponse(404, {});
    });
    const user = userEvent.setup();
    render(<Messaging onViewProfile={vi.fn()} />);
    await screen.findByText('Bob');
    await user.click(screen.getByText('Bob'));
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/messaging/conversations/c1/messages'),
    );
    expect(hoisted.mockApiFetch.mock.calls.some((c) => c[0] === '/messaging/conversations/c1/read' && c[1]?.method === 'POST')).toBe(true);
  });

  it('WebSocket_constructor_receives_token_query', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path) => {
      if (path === '/messaging/conversations') return makeResponse(200, { conversations: [] });
      if (path === '/social/friends') return makeResponse(200, []);
      return makeResponse(404, {});
    });
    render(<Messaging onViewProfile={vi.fn()} />);
    await waitFor(() => expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1));
    expect(MockWebSocket.instances[0].url).toContain('token=jwt-token');
  });
});
