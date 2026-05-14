import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { makeResponse } from '../../_fakes/fetch.js';

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
  resolveImageUrl: (u) => hoisted.mockResolveImageUrl(u),
  getDefaultAvatar: (n) => hoisted.mockGetDefaultAvatar(n),
}));

import Profile from '@/components/Social/Profile.jsx';
import { ConfirmProvider } from '@/components/Common/ConfirmDialog.jsx';

function renderProfile(props = {}) {
  return render(
    <ConfirmProvider>
      <Profile onStartChat={vi.fn()} {...props} />
    </ConfirmProvider>,
  );
}

describe('Profile', () => {
  beforeEach(() => {
    hoisted.mockUseAuth.mockReturnValue({
      user: { id: 'u-self', full_name: 'Self User', bio: 'my bio', avatar_url: null },
      refreshProfile: vi.fn(),
    });
    hoisted.mockApiFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('own_profile_does_not_call_GET_account_id', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path) => {
      if (path === '/social/users/u-self/posts?limit=50') return makeResponse(200, { posts: [] });
      if (path === '/social/friends') return makeResponse(200, []);
      return makeResponse(404, {});
    });
    renderProfile();
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/users/u-self/posts?limit=50'),
    );
    expect(hoisted.mockApiFetch.mock.calls.some((c) => String(c[0]).startsWith('/account/u-'))).toBe(false);
    expect(screen.getByText('Self User')).toBeInTheDocument();
  });

  it('other_profile_fetches_GET_account_target_and_posts', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path) => {
      if (path === '/account/u-other') {
        return makeResponse(200, { id: 'u-other', full_name: 'Other', bio: '', avatar_url: null, cover_url: null });
      }
      if (path === '/social/users/u-other/posts?limit=50') return makeResponse(200, { posts: [] });
      if (path === '/social/friends') return makeResponse(200, []);
      return makeResponse(404, {});
    });
    renderProfile({ targetUserId: 'u-other' });
    await waitFor(() => expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/account/u-other'));
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/users/u-other/posts?limit=50'),
    );
  });

  it('other_profile_not_found_shows_message_when_account_not_ok', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path) => {
      if (path === '/account/u-missing') return makeResponse(404, {}, { ok: false });
      if (path === '/social/users/u-missing/posts?limit=50') return makeResponse(200, { posts: [] });
      if (path === '/social/friends') return makeResponse(200, []);
      return makeResponse(404, {});
    });
    renderProfile({ targetUserId: 'u-missing' });
    await waitFor(() => expect(screen.getByText('Không tìm thấy người dùng')).toBeInTheDocument());
  });
});
