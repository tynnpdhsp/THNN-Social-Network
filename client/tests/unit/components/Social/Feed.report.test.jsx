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
  toastSuccess: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...a) => hoisted.toastError(...a),
    success: (...a) => hoisted.toastSuccess(...a),
  },
}));

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => hoisted.mockUseAuth(),
}));

vi.mock('@/config/api.js', () => ({
  apiFetch: (...args) => hoisted.mockApiFetch(...args),
  resolveImageUrl: (u) => hoisted.mockResolveImageUrl(u),
  getDefaultAvatar: (n) => hoisted.mockGetDefaultAvatar(n),
}));

import Feed from '@/components/Social/Feed.jsx';
import { ConfirmProvider } from '@/components/Common/ConfirmDialog.jsx';

function makePost(overrides = {}) {
  return {
    id: 'p-r1',
    user_id: 'other',
    user_info: { full_name: 'Stranger', avatar_url: null },
    content: 'Report me',
    created_at: '2026-03-01T08:00:00.000Z',
    images: [],
    is_liked: false,
    like_count: 0,
    comment_count: 0,
    visibility: 'public',
    ...overrides,
  };
}

function renderFeed(props = {}) {
  return render(
    <ConfirmProvider>
      <Feed onViewProfile={vi.fn()} {...props} />
    </ConfirmProvider>,
  );
}

async function waitForFeedReady() {
  await waitFor(() => expect(document.getElementById('feed-post-input')).toBeTruthy());
}

describe('Feed — report / block / delete / edit', () => {
  beforeEach(() => {
    hoisted.mockUseAuth.mockReturnValue({
      user: { id: 'u-me', full_name: 'Me', avatar_url: null },
    });
    hoisted.mockApiFetch.mockReset();
    hoisted.toastError.mockReset();
    hoisted.toastSuccess.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('report_menu_opens_modal_and_submitReport_POSTs_typed_URL_with_reason_query_and_description_body', async () => {
    const post = makePost({ id: 'rep-1' });
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    const card = document.getElementById('post-rep-1');
    await user.click(within(card).getAllByRole('button')[0]);
    await user.click(screen.getByRole('button', { name: /Báo cáo/i }));
    await screen.findByRole('heading', { name: 'Báo cáo nội dung' });
    await user.type(screen.getByPlaceholderText(/Mô tả thêm/), 'More detail');
    await user.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));
    await waitFor(() => {
      const call = hoisted.mockApiFetch.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].startsWith('/social/reports/post/rep-1'),
      );
      expect(call).toBeTruthy();
      expect(call[0]).toContain('reason=');
      expect(call[1].method).toBe('POST');
      expect(JSON.parse(call[1].body)).toEqual({ description: 'More detail' });
    });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Báo cáo nội dung' })).not.toBeInTheDocument());
  });

  it('report_reason_dropdown_changes_encoded_reason_in_submit_URL', async () => {
    const post = makePost({ id: 'rep-2' });
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-rep-2')).getAllByRole('button')[0]);
    await user.click(screen.getByRole('button', { name: /Báo cáo/i }));
    const modal = screen.getByRole('heading', { name: 'Báo cáo nội dung' }).closest('.premium-modal-box');
    await user.click(within(modal).getByRole('button', { name: /Spam \/ Quảng cáo/i }));
    await user.click(within(modal).getByText('Quấy rối / Đe dọa'));
    await user.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));
    await waitFor(() => {
      const call = hoisted.mockApiFetch.mock.calls.find((c) => String(c[0]).includes('/social/reports/post/rep-2'));
      expect(call[0]).toContain(encodeURIComponent('harassment'));
    });
  });

  it('report_modal_cancel_closes_without_api_when_secondary_clicked', async () => {
    const post = makePost({ id: 'rep-3' });
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-rep-3')).getAllByRole('button')[0]);
    await user.click(screen.getByRole('button', { name: /Báo cáo/i }));
    await screen.findByRole('heading', { name: 'Báo cáo nội dung' });
    const modal = screen.getByRole('heading', { name: 'Báo cáo nội dung' }).closest('.premium-modal-box');
    const n = hoisted.mockApiFetch.mock.calls.length;
    await user.click(within(modal).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Báo cáo nội dung' })).not.toBeInTheDocument());
    expect(hoisted.mockApiFetch.mock.calls.length).toBe(n);
  });

  it('submitReport_closes_modal_even_when_api_returns_non_ok_without_throwing', async () => {
    const post = makePost({ id: 'rep-4' });
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(makeResponse(502, { detail: 'bad gateway' }, { ok: false }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-rep-4')).getAllByRole('button')[0]);
    await user.click(screen.getByRole('button', { name: /Báo cáo/i }));
    await screen.findByRole('heading', { name: 'Báo cáo nội dung' });
    await user.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));
    await waitFor(() =>
      expect(hoisted.mockApiFetch.mock.calls.some((c) => String(c[0]).includes('/social/reports/post/rep-4'))).toBe(true),
    );
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Báo cáo nội dung' })).not.toBeInTheDocument());
  });

  it('handleBlock_confirm_posts_block_toasts_and_reload_feed', async () => {
    const post = makePost({ id: 'blk-1' });
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-blk-1')).getAllByRole('button')[0]);
    await user.click(screen.getByRole('button', { name: /^Chặn$/ }));
    await user.click(await screen.findByRole('button', { name: /^Chặn$/ }));
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/blocks/other', { method: 'POST' }),
    );
    expect(hoisted.toastSuccess).toHaveBeenCalledWith('Đã chặn người dùng');
  });

  it('handleBlock_cancel_does_not_POST', async () => {
    const post = makePost({ id: 'blk-2' });
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-blk-2')).getAllByRole('button')[0]);
    await user.click(screen.getByRole('button', { name: /^Chặn$/ }));
    await screen.findByText(/Người dùng này sẽ không thể xem bài viết hay liên hệ với bạn/);
    await user.keyboard('{Escape}');
    expect(hoisted.mockApiFetch.mock.calls.some((c) => c[0]?.includes?.('/social/blocks/'))).toBe(false);
  });

  it('owner_menu_shows_edit_and_delete_not_report', async () => {
    const post = makePost({ id: 'own-1', user_id: 'u-me', user_info: { full_name: 'Me', avatar_url: null } });
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-own-1')).getAllByRole('button')[0]);
    expect(screen.queryByRole('button', { name: /Báo cáo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sửa bài/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xóa bài/i })).toBeInTheDocument();
  });

  it('handleDeletePost_confirm_deletes_toasts_and_loads_feed', async () => {
    const post = makePost({ id: 'del-1', user_id: 'u-me', user_info: { full_name: 'Me', avatar_url: null } });
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-del-1')).getAllByRole('button')[0]);
    await user.click(screen.getByRole('button', { name: /Xóa bài/i }));
    await user.click(await screen.findByRole('button', { name: 'Xóa bài viết' }));
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/posts/del-1', { method: 'DELETE' }),
    );
    expect(hoisted.toastSuccess).toHaveBeenCalledWith('Đã xóa bài viết');
  });

  it('handleDeletePost_cancel_skips_DELETE', async () => {
    const post = makePost({ id: 'del-2', user_id: 'u-me', user_info: { full_name: 'Me', avatar_url: null } });
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-del-2')).getAllByRole('button')[0]);
    await user.click(screen.getByRole('button', { name: /Xóa bài/i }));
    const keep = await screen.findByRole('button', { name: 'Giữ lại' });
    await user.click(keep);
    expect(hoisted.mockApiFetch.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(false);
  });

  it('handleUpdatePost_PUTs_content_and_visibility_on_save', async () => {
    const post = makePost({
      id: 'ed-1',
      user_id: 'u-me',
      user_info: { full_name: 'Me', avatar_url: null },
      content: 'Old',
      visibility: 'public',
    });
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-ed-1')).getAllByRole('button')[0]);
    await user.click(screen.getByRole('button', { name: /Sửa bài/i }));
    await screen.findByRole('heading', { name: 'Chỉnh sửa bài viết' });
    const modal = screen.getByRole('heading', { name: 'Chỉnh sửa bài viết' }).closest('.premium-modal-box');
    const ta = modal.querySelector('textarea.input-field');
    await user.clear(ta);
    await user.type(ta, 'New body');
    await user.click(within(modal).getByRole('button', { name: /Công khai/ }));
    await user.click(within(modal).getByText('Riêng tư'));
    await user.click(within(modal).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => {
      const put = hoisted.mockApiFetch.mock.calls.find(
        (c) => c[0] === '/social/posts/ed-1' && c[1]?.method === 'PUT',
      );
      expect(put).toBeTruthy();
      expect(JSON.parse(put[1].body)).toEqual({ content: 'New body', visibility: 'private' });
    });
  });

  it('handleUpdatePost_noop_when_editContent_is_blank', async () => {
    const post = makePost({
      id: 'ed-2',
      user_id: 'u-me',
      user_info: { full_name: 'Me', avatar_url: null },
      content: 'X',
      visibility: 'public',
    });
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-ed-2')).getAllByRole('button')[0]);
    await user.click(screen.getByRole('button', { name: /Sửa bài/i }));
    await screen.findByRole('heading', { name: 'Chỉnh sửa bài viết' });
    const modal = screen.getByRole('heading', { name: 'Chỉnh sửa bài viết' }).closest('.premium-modal-box');
    const ta = modal.querySelector('textarea.input-field');
    await user.clear(ta);
    await user.type(ta, '   ');
    const n = hoisted.mockApiFetch.mock.calls.length;
    await user.click(within(modal).getByRole('button', { name: 'Lưu thay đổi' }));
    expect(hoisted.mockApiFetch.mock.calls.length).toBe(n);
  });

  it('handleUpdatePost_does_not_close_edit_when_response_not_ok', async () => {
    const post = makePost({
      id: 'ed-3',
      user_id: 'u-me',
      user_info: { full_name: 'Me', avatar_url: null },
      content: 'Keep modal',
      visibility: 'public',
    });
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(makeResponse(400, {}, { ok: false }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-ed-3')).getAllByRole('button')[0]);
    await user.click(screen.getByRole('button', { name: /Sửa bài/i }));
    await screen.findByRole('heading', { name: 'Chỉnh sửa bài viết' });
    const modal = screen.getByRole('heading', { name: 'Chỉnh sửa bài viết' }).closest('.premium-modal-box');
    await user.click(within(modal).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith(
        '/social/posts/ed-3',
        expect.objectContaining({ method: 'PUT' }),
      ),
    );
    expect(screen.getByRole('heading', { name: 'Chỉnh sửa bài viết' })).toBeInTheDocument();
  });
});
