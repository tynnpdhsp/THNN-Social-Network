import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { makeResponse } from '../../_fakes/fetch.js';

const hoisted = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockApiFetch: vi.fn(),
  mockResolveImageUrl: vi.fn((u) => u || ''),
  mockGetDefaultAvatar: vi.fn((n) => `avatar:${n || 'U'}`),
  toastSuccess: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: (...a) => hoisted.toastSuccess(...a) },
}));

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => hoisted.mockUseAuth(),
}));

vi.mock('@/config/api.js', () => ({
  apiFetch: (...a) => hoisted.mockApiFetch(...a),
  resolveImageUrl: (u) => hoisted.mockResolveImageUrl(u),
  getDefaultAvatar: (n) => hoisted.mockGetDefaultAvatar(n),
}));

import Friends from '@/components/Social/Friends.jsx';
import { ConfirmProvider } from '@/components/Common/ConfirmDialog.jsx';

function renderFriends() {
  return render(
    <ConfirmProvider>
      <Friends onViewProfile={vi.fn()} />
    </ConfirmProvider>,
  );
}

describe('Friends', () => {
  beforeEach(() => {
    hoisted.mockUseAuth.mockReturnValue({ user: { id: 'me', full_name: 'Me', avatar_url: null } });
    hoisted.mockApiFetch.mockReset();
    hoisted.toastSuccess.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loadData_fetches_requests_and_friends', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path) => {
      if (path === '/social/friends/requests') return makeResponse(200, []);
      if (path === '/social/friends') return makeResponse(200, []);
      return makeResponse(404, {});
    });
    renderFriends();
    await waitFor(() => {
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/friends/requests');
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/friends');
    });
  });

  it('handleSearch_noop_when_query_blank', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path) => {
      if (path === '/social/friends/requests') return makeResponse(200, []);
      if (path === '/social/friends') return makeResponse(200, []);
      return makeResponse(404, {});
    });
    const user = userEvent.setup();
    renderFriends();
    await waitFor(() => screen.getByPlaceholderText(/Tìm kiếm theo tên/));
    const n = hoisted.mockApiFetch.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Tìm' }));
    expect(hoisted.mockApiFetch.mock.calls.length).toBe(n);
  });

  it('handleSearch_calls_account_search_with_encoded_query', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path) => {
      if (path === '/social/friends/requests') return makeResponse(200, []);
      if (path === '/social/friends') return makeResponse(200, []);
      if (String(path).startsWith('/account/search')) return makeResponse(200, []);
      return makeResponse(404, {});
    });
    const user = userEvent.setup();
    renderFriends();
    await waitFor(() => screen.getByPlaceholderText(/Tìm kiếm theo tên/));
    await user.type(screen.getByPlaceholderText(/Tìm kiếm theo tên/), 'An');
    await user.click(screen.getByRole('button', { name: 'Tìm' }));
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/account/search?query=An'),
    );
  });

  it('sendRequest_POSTs_friend_request_path', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/social/friends/requests') return makeResponse(200, []);
      if (path === '/social/friends') return makeResponse(200, []);
      if (String(path).startsWith('/account/search')) {
        return makeResponse(200, [{ id: 'x1', full_name: 'Xuân', avatar_url: null, friend_status: 'none' }]);
      }
      if (path === '/social/friends/requests/x1' && init?.method === 'POST') return makeResponse(200, {});
      return makeResponse(404, {});
    });
    const user = userEvent.setup();
    renderFriends();
    await waitFor(() => screen.getByPlaceholderText(/Tìm kiếm theo tên/));
    await user.type(screen.getByPlaceholderText(/Tìm kiếm theo tên/), 'X');
    await user.click(screen.getByRole('button', { name: 'Tìm' }));
    await screen.findByText('Xuân');
    await user.click(screen.getByRole('button', { name: /Kết bạn/i }));
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/friends/requests/x1', { method: 'POST' }),
    );
  });

  it('acceptRequest_from_pending_list_POSTs_accept', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/social/friends/requests') {
        return makeResponse(200, [{ from_id: 'f99', full_name: 'Người gửi' }]);
      }
      if (path === '/social/friends') return makeResponse(200, []);
      if (path === '/social/friends/requests/f99/accept' && init?.method === 'POST') return makeResponse(200, {});
      return makeResponse(404, {});
    });
    const user = userEvent.setup();
    renderFriends();
    await screen.findByText('Người gửi');
    await user.click(screen.getByRole('button', { name: /Nhận/i }));
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/friends/requests/f99/accept', { method: 'POST' }),
    );
  });

  it('unfriend_confirm_true_DELETEs_and_toasts', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/social/friends/requests') return makeResponse(200, []);
      if (path === '/social/friends') {
        return makeResponse(200, [{ id: 'pal', full_name: 'Pal', avatar_url: null }]);
      }
      if (path === '/social/friends/pal' && init?.method === 'DELETE') return makeResponse(200, {});
      return makeResponse(404, {});
    });
    const user = userEvent.setup();
    renderFriends();
    await screen.findByText('Pal');
    await user.click(screen.getByRole('button', { name: 'Hủy bạn' }));
    await user.click(await screen.findByRole('button', { name: 'Hủy kết bạn' }));
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/friends/pal', { method: 'DELETE' }),
    );
    expect(hoisted.toastSuccess).toHaveBeenCalledWith('Đã hủy kết bạn');
  });
});
