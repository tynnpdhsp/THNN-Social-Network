import { mockUseAuth, defaultAuthMockValue } from '../../_fakes/setupAuthMock.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { makeResponse } from '../../_fakes/fetch.js';

const hoisted = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
}));

vi.mock('@/config/api.js', () => ({
  apiFetch: (...a) => hoisted.mockApiFetch(...a),
}));

import Settings from '@/components/Social/Settings.jsx';

describe('Settings', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(defaultAuthMockValue());
    hoisted.mockApiFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('load_parallel_fetches_privacy_notifications_blocks_orders', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path) => {
      if (path === '/account/me/privacy') return makeResponse(200, { whoCanSeePosts: 'everyone', whoCanMessage: 'everyone', whoCanFriendReq: 'everyone' });
      if (path === '/account/me/notification-settings') return makeResponse(200, { email: true });
      if (path === '/social/blocks') return makeResponse(200, []);
      if (path === '/account/me/orders') return makeResponse(200, { orders: [] });
      return makeResponse(404, {});
    });
    render(<Settings />);
    await waitFor(() => {
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/account/me/privacy');
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/account/me/notification-settings');
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/blocks');
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/account/me/orders');
    });
    await screen.findByText('Cài đặt');
  });

  it('savePrivacy_PUTs_privacy_json', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/account/me/privacy' && !init?.method) return makeResponse(200, { whoCanSeePosts: 'everyone', whoCanMessage: 'everyone', whoCanFriendReq: 'everyone' });
      if (path === '/account/me/notification-settings') return makeResponse(200, {});
      if (path === '/social/blocks') return makeResponse(200, []);
      if (path === '/account/me/orders') return makeResponse(200, { orders: [] });
      if (path === '/account/me/privacy' && init?.method === 'PUT') return makeResponse(200, {});
      return makeResponse(404, {});
    });
    const user = userEvent.setup();
    render(<Settings />);
    await screen.findByText('Cài đặt');
    const saveButtons = screen.getAllByRole('button', { name: /Lưu/i });
    await user.click(saveButtons[0]);
    await waitFor(() => {
      const put = hoisted.mockApiFetch.mock.calls.find(
        (c) => c[0] === '/account/me/privacy' && c[1]?.method === 'PUT',
      );
      expect(put).toBeTruthy();
      expect(JSON.parse(put[1].body).whoCanSeePosts).toBe('everyone');
    });
  });
});
