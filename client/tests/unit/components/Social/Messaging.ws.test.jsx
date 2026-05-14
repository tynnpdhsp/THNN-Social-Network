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

describe('Messaging — WebSocket new_message', () => {
  let restoreWs;

  beforeEach(() => {
    restoreWs = installMockWebSocket();
    hoisted.mockUseAuth.mockReturnValue({
      user: { id: 'me', full_name: 'Me', avatar_url: null },
      token: 'jwt-token',
    });
    hoisted.mockApiFetch.mockReset();
  });

  afterEach(() => {
    restoreWs();
    vi.clearAllMocks();
  });

  it('ws_new_message_appends_to_messages_when_viewing_same_conversation', async () => {
    const conv = {
      id: 'c-open',
      type: 'direct',
      other_member: { id: 'peer', full_name: 'Peer', avatar_url: null },
      last_message: { content: 'old', created_at: '2026-01-01T10:00:00.000Z' },
      members: [{ user_id: 'me', last_read_at: '2026-01-01T09:00:00.000Z' }],
    };
    hoisted.mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/messaging/conversations') return makeResponse(200, { conversations: [conv] });
      if (path === '/social/friends') return makeResponse(200, []);
      if (path === '/messaging/conversations/c-open/messages') {
        return makeResponse(200, { messages: [{ id: 'm-old', sender_id: 'peer', content: 'old', created_at: '2026-01-01T10:00:00.000Z' }] });
      }
      if (path === '/messaging/conversations/c-open/read' && init?.method === 'POST') return makeResponse(200, {});
      return makeResponse(404, {});
    });
    const user = userEvent.setup();
    render(<Messaging onViewProfile={vi.fn()} />);
    await screen.findByText('Peer');
    await user.click(screen.getByText('Peer'));
    await waitFor(() => expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1));
    const ws = MockWebSocket.instances[0];
    ws.simulateMessage({
      type: 'new_message',
      data: {
        id: 'm-ws',
        sender_id: 'peer',
        conversation_id: 'c-open',
        content: 'from socket',
        created_at: '2026-01-01T11:00:00.000Z',
      },
    });
    await screen.findByText('from socket');
  });
});
