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
import { resolveImageUrl } from '@/config/api.js';

function makePost(overrides = {}) {
  return {
    id: 'p1',
    user_id: 'other',
    user_info: { full_name: 'Other User', avatar_url: null },
    content: 'Post body',
    created_at: '2026-01-15T10:00:00.000Z',
    images: [],
    is_liked: false,
    like_count: 2,
    comment_count: 1,
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
  await waitFor(() => {
    expect(document.getElementById('feed-post-input')).toBeTruthy();
  });
}

describe('Feed — posts / composer / feed load / focus / like / friend', () => {
  beforeEach(() => {
    hoisted.mockUseAuth.mockReturnValue({
      user: { id: 'u-me', full_name: 'Me', avatar_url: null },
    });
    hoisted.mockApiFetch.mockReset();
    hoisted.mockResolveImageUrl.mockImplementation((u) => u || '');
    hoisted.mockGetDefaultAvatar.mockImplementation((n) => `avatar:${n || 'U'}`);
    hoisted.toastError.mockReset();
    hoisted.toastSuccess.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loadFeed_on_mount_calls_GET_social_feed_then_hides_spinner', async () => {
    hoisted.mockApiFetch.mockResolvedValueOnce(makeResponse(200, { posts: [makePost()] }));
    renderFeed();
    await waitFor(() => expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/feed'));
    await waitFor(() => expect(screen.getByText('Post body')).toBeInTheDocument());
  });

  it('loadFeed_sets_empty_array_when_posts_missing_in_JSON', async () => {
    hoisted.mockApiFetch.mockResolvedValueOnce(makeResponse(200, {}));
    renderFeed();
    await waitForFeedReady();
    expect(screen.getByText('Chưa có bài viết nào')).toBeInTheDocument();
  });

  it('loadFeed_api_reject_still_sets_loading_false_and_shows_empty_state', async () => {
    hoisted.mockApiFetch.mockRejectedValueOnce(new Error('network'));
    renderFeed();
    await waitForFeedReady();
    expect(screen.getByText('Chưa có bài viết nào')).toBeInTheDocument();
  });

  it('loadFeed_json_parse_failure_in_catch_leaves_posts_empty', async () => {
    const bad = makeResponse(200, {}, {});
    bad.json = async () => {
      throw new Error('parse');
    };
    hoisted.mockApiFetch.mockResolvedValueOnce(bad);
    renderFeed();
    await waitForFeedReady();
    expect(screen.getByText('Chưa có bài viết nào')).toBeInTheDocument();
  });

  it('handleCreatePost_noop_when_trimmed_content_empty_and_no_images', async () => {
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    const initialCalls = hoisted.mockApiFetch.mock.calls.length;
    await user.type(screen.getByPlaceholderText(/Chia sẻ suy nghĩ/), '   \n\t  ');
    await user.click(screen.getByRole('button', { name: 'Đăng bài' }));
    expect(hoisted.mockApiFetch.mock.calls.length).toBe(initialCalls);
  });

  it('handleCreatePost_POSTs_with_content_visibility_and_images_then_clears_on_ok', async () => {
    const post = makePost();
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(
        makeResponse(201, {}, { ok: true }),
      )
      .mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(screen.getByRole('button', { name: /Công khai/ }));
    await user.click(screen.getByText('Bạn bè'));
    await user.type(screen.getByPlaceholderText(/Chia sẻ suy nghĩ/), '  Hello feed  ');
    await user.click(screen.getByRole('button', { name: 'Đăng bài' }));
    await waitFor(() => {
      const createCall = hoisted.mockApiFetch.mock.calls.find(
        (c) => c[0] === '/social/posts' && c[1]?.method === 'POST',
      );
      expect(createCall).toBeTruthy();
      const body = JSON.parse(createCall[1].body);
      expect(body).toEqual({
        content: '  Hello feed  ',
        visibility: 'friends',
        images: [],
      });
    });
    await waitFor(() => expect(screen.getByPlaceholderText(/Chia sẻ suy nghĩ/)).toHaveValue(''));
  });

  it('handleCreatePost_allows_image_only_when_content_is_whitespace', async () => {
    const post = makePost();
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(makeResponse(200, { media_url: 'minio/x.png', media_type: 'image' }))
      .mockResolvedValueOnce(makeResponse(201, {}, { ok: true }))
      .mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.type(screen.getByPlaceholderText(/Chia sẻ suy nghĩ/), '   ');
    const hiddenInput = document.querySelector('input[type="file"]');
    expect(hiddenInput).toBeTruthy();
    await user.upload(hiddenInput, new File(['x'], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đăng bài' })).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Đăng bài' }));
    await waitFor(() => {
      const createCall = hoisted.mockApiFetch.mock.calls.find(
        (c) => c[0] === '/social/posts' && c[1]?.method === 'POST',
      );
      expect(createCall).toBeTruthy();
      const body = JSON.parse(createCall[1].body);
      expect(body.images).toEqual([
        { image_url: 'minio/x.png', media_type: 'image', display_order: 0 },
      ]);
      expect(body.content).toBe('   ');
    });
  });

  it('handleCreatePost_does_not_clear_composer_when_response_not_ok', async () => {
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [] }))
      .mockResolvedValueOnce(makeResponse(400, { detail: 'bad' }, { ok: false }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.type(screen.getByPlaceholderText(/Chia sẻ suy nghĩ/), 'Keep me');
    await user.click(screen.getByRole('button', { name: 'Đăng bài' }));
    await waitFor(() => expect(screen.getByPlaceholderText(/Chia sẻ suy nghĩ/)).toHaveValue('Keep me'));
  });

  it('handleCreatePost_swallows_throw_from_apiFetch_sets_posting_false', async () => {
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [] }))
      .mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.type(screen.getByPlaceholderText(/Chia sẻ suy nghĩ/), 'X');
    await user.click(screen.getByRole('button', { name: 'Đăng bài' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đăng bài' })).not.toBeDisabled());
  });

  it('handleUploadImages_toasts_error_with_detail_when_res_not_ok', async () => {
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [] }))
      .mockResolvedValueOnce(makeResponse(400, { detail: 'File too large' }, { ok: false }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    const hiddenInput = document.querySelector('input[type="file"]');
    await user.upload(hiddenInput, new File(['x'], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(hoisted.toastError).toHaveBeenCalledWith('Tải lên thất bại: File too large'));
  });

  it('handleUploadImages_toasts_statusText_when_no_detail', async () => {
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [] }))
      .mockResolvedValueOnce(makeResponse(500, {}, { ok: false, text: async () => '' }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    const hiddenInput = document.querySelector('input[type="file"]');
    await user.upload(hiddenInput, new File(['x'], 'b.png', { type: 'image/png' }));
    await waitFor(() => expect(hoisted.toastError).toHaveBeenCalled());
    expect(String(hoisted.toastError.mock.calls[0][0])).toMatch(/Tải lên thất bại/);
  });

  it('handleUploadImages_network_error_toasts_MinIO_message', async () => {
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [] }))
      .mockRejectedValueOnce(new Error('net'));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    const hiddenInput = document.querySelector('input[type="file"]');
    await user.upload(hiddenInput, new File(['x'], 'c.png', { type: 'image/png' }));
    await waitFor(() =>
      expect(hoisted.toastError).toHaveBeenCalledWith(
        'Không thể tải file. Kiểm tra kết nối server/MinIO.',
      ),
    );
  });

  it('handleUploadImages_appends_multiple_successful_uploads', async () => {
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [] }))
      .mockResolvedValueOnce(makeResponse(200, { media_url: 'u1', media_type: 'image' }))
      .mockResolvedValueOnce(makeResponse(200, { media_url: 'u2', media_type: 'image' }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    const hiddenInput = document.querySelector('input[type="file"]');
    const f1 = new File(['1'], '1.png', { type: 'image/png' });
    const f2 = new File(['2'], '2.png', { type: 'image/png' });
    await user.upload(hiddenInput, [f1, f2]);
    await waitFor(() => {
      const uploads = hoisted.mockApiFetch.mock.calls.filter(
        (c) => c[0] === '/social/media/upload' && c[1]?.method === 'POST',
      );
      expect(uploads.length).toBe(2);
    });
  });

  it('handleUploadImages_ok_without_image_url_does_not_add_preview_row', async () => {
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [] }))
      .mockResolvedValueOnce(makeResponse(200, {}));
    const user = userEvent.setup();
    const { container } = renderFeed();
    await waitForFeedReady();
    const hiddenInput = document.querySelector('input[type="file"]');
    await user.upload(hiddenInput, new File(['x'], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/media/upload', expect.anything()));
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(1);
  });

  it('preview_remove_button_removes_uploaded_preview', async () => {
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [] }))
      .mockResolvedValueOnce(makeResponse(200, { media_url: 'only', media_type: 'image' }));
    const user = userEvent.setup();
    const { container } = renderFeed();
    await waitForFeedReady();
    const hiddenInput = document.querySelector('input[type="file"]');
    await user.upload(hiddenInput, new File(['x'], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(container.querySelectorAll('img').length).toBeGreaterThanOrEqual(2));
    const submitBtn = screen.getByRole('button', { name: 'Đăng bài' });
    let createCard = submitBtn.parentElement;
    while (createCard && !createCard.querySelector('#feed-post-input')) {
      createCard = createCard.parentElement;
    }
    expect(createCard).toBeTruthy();
    const previewRemove = [...createCard.querySelectorAll('img')]
      .find((i) => i.getAttribute('src') === resolveImageUrl('only'))
      ?.parentElement?.querySelector('button');
    expect(previewRemove).toBeTruthy();
    await user.click(previewRemove);
    await waitFor(() => expect(container.querySelectorAll('img').length).toBe(1));
  });

  it('focusPostId_after_posts_load_calls_scrollIntoView_and_onPostFocused', async () => {
    const onPostFocused = vi.fn();
    const post = makePost({ id: 'focus-99' });
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [post] }));
    renderFeed({ focusPostId: 'focus-99', onPostFocused });
    await waitFor(() => expect(document.getElementById('post-focus-99')).toBeTruthy());
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled(), { timeout: 4000 });
    await waitFor(() => expect(onPostFocused).toHaveBeenCalled(), { timeout: 4000 });
  });

  it('focusPostId_when_element_missing_still_invokes_onPostFocused_after_delay', async () => {
    Element.prototype.scrollIntoView.mockClear();
    const onPostFocused = vi.fn();
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [makePost({ id: 'other-id' })] }));
    renderFeed({ focusPostId: 'missing-id', onPostFocused });
    await waitFor(() => expect(document.getElementById('post-other-id')).toBeInTheDocument());
    await waitFor(() => expect(onPostFocused).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('handleLike_POSTs_like_then_triggers_second_loadFeed', async () => {
    const p = makePost({ id: 'like-1' });
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [p] }))
      .mockResolvedValue(makeResponse(200, { posts: [p] }));
    const user = userEvent.setup();
    renderFeed();
    await waitFor(() => expect(document.getElementById('post-like-1')).toBeInTheDocument());
    const card = document.getElementById('post-like-1');
    const buttons = within(card).getAllByRole('button');
    await user.click(buttons[1]);
    await waitFor(() => {
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/posts/like-1/like', { method: 'POST' });
    });
  });

  it('handleAddFriend_POSTs_friend_request', async () => {
    const p = makePost({ id: 'fp1', user_id: 'stranger' });
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { posts: [p] }));
    const user = userEvent.setup();
    renderFeed();
    await waitFor(() => expect(document.getElementById('post-fp1')).toBeInTheDocument());
    const card = document.getElementById('post-fp1');
    const buttons = within(card).getAllByRole('button');
    await user.click(buttons[0]);
    await user.click(await screen.findByRole('button', { name: /Kết bạn/i }));
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/friends/requests/stranger', { method: 'POST' }),
    );
  });

  it('onViewProfile_called_when_clicking_avatar_or_name', async () => {
    const onViewProfile = vi.fn();
    const p = makePost({ user_id: 'u-x' });
    hoisted.mockApiFetch.mockResolvedValueOnce(makeResponse(200, { posts: [p] }));
    const user = userEvent.setup();
    renderFeed({ onViewProfile });
    await waitFor(() => expect(screen.getByText('Other User')).toBeInTheDocument());
    await user.click(screen.getByText('Other User'));
    expect(onViewProfile).toHaveBeenCalledWith('u-x');
  });
});
