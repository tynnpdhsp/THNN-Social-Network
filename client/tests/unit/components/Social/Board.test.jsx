import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { makeResponse } from '../../_fakes/fetch.js';

const hoisted = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockApiFetch: vi.fn(),
  mockResolveImageUrl: vi.fn((u) => u || ''),
  mockGetDefaultAvatar: vi.fn((n) => `avatar:${n || 'U'}`),
  toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: (...a) => hoisted.toastError(...a) },
}));

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => hoisted.mockUseAuth(),
}));

vi.mock('@/config/api.js', () => ({
  apiFetch: (...a) => hoisted.mockApiFetch(...a),
  resolveImageUrl: (u) => hoisted.mockResolveImageUrl(u),
  getDefaultAvatar: (n) => hoisted.mockGetDefaultAvatar(n),
}));

import Board from '@/components/Social/Board.jsx';

describe('Board', () => {
  beforeEach(() => {
    hoisted.mockUseAuth.mockReturnValue({ user: { id: 'u1', full_name: 'Me', avatar_url: null } });
    hoisted.mockApiFetch.mockReset();
    hoisted.toastError.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('mount_loads_tags_and_posts_in_parallel', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path) => {
      if (path === '/board/tags') return makeResponse(200, [{ id: 'tag-a', name: 'Mua' }]);
      if (path === '/board/posts') return makeResponse(200, { posts: [] });
      return makeResponse(404, {});
    });
    render(<Board />);
    await waitFor(() => {
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/board/tags');
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/board/posts');
    });
  });

  it('filter_by_tag_appends_tag_id_query', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path) => {
      if (path === '/board/tags') return makeResponse(200, [{ id: 't1', name: 'Bán' }]);
      if (path === '/board/posts' || path === '/board/posts?tag_id=t1') return makeResponse(200, { posts: [] });
      return makeResponse(404, {});
    });
    const user = userEvent.setup();
    render(<Board />);
    await waitFor(() => screen.getByText('Tất cả'));
    const filterRow = screen.getByText('Tất cả').parentElement;
    await user.click(within(filterRow).getByText('Bán'));
    await waitFor(() => expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/board/posts?tag_id=t1'));
  });

  it('handleCreatePost_noop_when_content_empty_even_with_images_in_state', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/board/tags') return makeResponse(200, [{ id: 't1', name: 'X' }]);
      if (path === '/board/posts') return makeResponse(200, { posts: [] });
      if (path === '/social/media/upload' && init?.method === 'POST') return makeResponse(200, { image_url: 'img1' });
      return makeResponse(404, {});
    });
    const user = userEvent.setup();
    render(<Board />);
    await waitFor(() => document.getElementById('board-post-input'));
    const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
    await user.upload(fileInput, new File(['x'], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/media/upload', expect.anything()));
    const n = hoisted.mockApiFetch.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Đăng tin ngay' }));
    expect(hoisted.mockApiFetch.mock.calls.length).toBe(n);
  });

  it('handleCreatePost_POSTs_board_posts_with_board_tag_id_and_visibility', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/board/tags') return makeResponse(200, [{ id: 'tag-x', name: 'TagX' }]);
      if (path === '/board/posts' && !init?.method) return makeResponse(200, { posts: [] });
      if (path === '/board/posts' && init?.method === 'POST') return makeResponse(201, {});
      return makeResponse(404, {});
    });
    const user = userEvent.setup();
    render(<Board />);
    await waitFor(() => expect(screen.getAllByText('TagX').length).toBeGreaterThanOrEqual(1));
    await user.type(document.getElementById('board-post-input'), 'Sell bike');
    await user.click(screen.getByRole('button', { name: /Công khai/ }));
    await user.click(screen.getByText('Riêng tư'));
    await user.click(screen.getByRole('button', { name: 'Đăng tin ngay' }));
    await waitFor(() => {
      const post = hoisted.mockApiFetch.mock.calls.find((c) => c[0] === '/board/posts' && c[1]?.method === 'POST');
      expect(post).toBeTruthy();
      expect(JSON.parse(post[1].body)).toEqual({
        content: 'Sell bike',
        visibility: 'private',
        board_tag_id: 'tag-x',
        images: [],
      });
    });
  });

  it('handleUploadImages_res_not_ok_toasts', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/board/tags') return makeResponse(200, [{ id: 't1', name: 'X' }]);
      if (path === '/board/posts') return makeResponse(200, { posts: [] });
      if (path === '/social/media/upload') return makeResponse(400, { detail: 'bad' }, { ok: false });
      return makeResponse(404, {});
    });
    const user = userEvent.setup();
    render(<Board />);
    await waitFor(() => document.getElementById('board-post-input'));
    await user.upload(document.querySelector('input[type="file"]'), new File(['1'], '1.png', { type: 'image/png' }));
    await waitFor(() => expect(hoisted.toastError).toHaveBeenCalledWith('Tải ảnh thất bại: bad'));
  });
});
