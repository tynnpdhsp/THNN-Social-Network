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
    id: 'p-c1',
    user_id: 'other',
    user_info: { full_name: 'Author', avatar_url: null },
    content: 'Root post',
    created_at: '2026-02-01T12:00:00.000Z',
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

function commentSendButton() {
  const input = document.getElementById('comment-input');
  expect(input).toBeTruthy();
  return input.parentElement.querySelector('button.btn-primary');
}

describe('Feed — comments modal', () => {
  beforeEach(() => {
    hoisted.mockUseAuth.mockReturnValue({
      user: { id: 'u-me', full_name: 'Me', avatar_url: null },
    });
    hoisted.mockApiFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('openComments_fetches_GET_social_posts_id_comments', async () => {
    const post = makePost();
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(
        makeResponse(200, [
          {
            id: 'c1',
            content: 'First',
            created_at: '2026-02-01T12:05:00.000Z',
            user_info: { full_name: 'A', avatar_url: null },
            replies: [],
          },
        ]),
      );
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    const card = document.getElementById('post-p-c1');
    const buttons = within(card).getAllByRole('button');
    await user.click(buttons[2]);
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/social/posts/p-c1/comments'),
    );
    await screen.findByText('First');
  });

  it('openComments_on_fetch_rejection_sets_empty_comments', async () => {
    const post = makePost();
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    const card = document.getElementById('post-p-c1');
    await user.click(within(card).getAllByRole('button')[2]);
    await screen.findByText('Chưa có bình luận');
  });

  it('openComments_json_failure_in_catch_sets_empty_comments', async () => {
    const post = makePost();
    const bad = makeResponse(200, []);
    bad.json = async () => {
      throw new Error('json');
    };
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(bad);
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-p-c1')).getAllByRole('button')[2]);
    await screen.findByText('Chưa có bình luận');
  });

  it('sendComment_noop_when_commentText_is_whitespace_only', async () => {
    const post = makePost();
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(makeResponse(200, []));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-p-c1')).getAllByRole('button')[2]);
    await screen.findByPlaceholderText(/Viết bình luận/);
    await user.type(document.getElementById('comment-input'), '   \n');
    const postCallsBefore = hoisted.mockApiFetch.mock.calls.filter(
      (c) => c[0] === '/social/posts/p-c1/comments' && c[1]?.method === 'POST',
    ).length;
    await user.click(commentSendButton());
    const postCallsAfter = hoisted.mockApiFetch.mock.calls.filter(
      (c) => c[0] === '/social/posts/p-c1/comments' && c[1]?.method === 'POST',
    ).length;
    expect(postCallsAfter).toBe(postCallsBefore);
  });

  it('sendComment_POSTs_top_level_with_parent_comment_id_null_in_JSON', async () => {
    const post = makePost();
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(makeResponse(200, []))
      .mockResolvedValueOnce(makeResponse(200, {}, { ok: true }))
      .mockResolvedValueOnce(makeResponse(200, []))
      .mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-p-c1')).getAllByRole('button')[2]);
    await screen.findByPlaceholderText(/Viết bình luận/);
    await user.type(document.getElementById('comment-input'), 'Hi there');
    await user.click(commentSendButton());
    await waitFor(() => {
      const postComment = hoisted.mockApiFetch.mock.calls.find(
        (c) => c[0] === '/social/posts/p-c1/comments' && c[1]?.method === 'POST',
      );
      expect(postComment).toBeTruthy();
      expect(JSON.parse(postComment[1].body)).toEqual({
        content: 'Hi there',
        parent_comment_id: null,
      });
    });
  });

  it('sendComment_on_res_not_ok_keeps_comment_text', async () => {
    const post = makePost();
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(makeResponse(200, []))
      .mockResolvedValueOnce(makeResponse(400, { detail: 'no' }, { ok: false }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-p-c1')).getAllByRole('button')[2]);
    await screen.findByPlaceholderText(/Viết bình luận/);
    const input = document.getElementById('comment-input');
    await user.type(input, 'Stays');
    await user.click(commentSendButton());
    await waitFor(() => expect(input).toHaveValue('Stays'));
  });

  it('sendComment_reply_sets_parent_comment_id', async () => {
    const post = makePost();
    const thread = [
      {
        id: 'parent-1',
        content: 'Parent line',
        created_at: '2026-02-01T12:05:00.000Z',
        user_info: { full_name: 'ParentUser', avatar_url: null },
        replies: [],
      },
    ];
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(makeResponse(200, thread))
      .mockResolvedValueOnce(makeResponse(200, {}, { ok: true }))
      .mockResolvedValueOnce(makeResponse(200, thread))
      .mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-p-c1')).getAllByRole('button')[2]);
    await screen.findByText('Parent line');
    await user.click(screen.getByRole('button', { name: 'TRẢ LỜI' }));
    expect(screen.getByText(/Trả lời ParentUser/)).toBeInTheDocument();
    await user.type(document.getElementById('comment-input'), 'Child text');
    await user.click(commentSendButton());
    await waitFor(() => {
      const postComment = hoisted.mockApiFetch.mock.calls.find(
        (c) => c[0] === '/social/posts/p-c1/comments' && c[1]?.method === 'POST',
      );
      expect(JSON.parse(postComment[1].body)).toEqual({
        content: 'Child text',
        parent_comment_id: 'parent-1',
      });
    });
  });

  it('reply_cancel_button_clears_reply_context', async () => {
    const post = makePost();
    const thread = [
      {
        id: 'parent-1',
        content: 'Parent line',
        created_at: '2026-02-01T12:05:00.000Z',
        user_info: { full_name: 'ParentUser', avatar_url: null },
        replies: [],
      },
    ];
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(makeResponse(200, thread));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-p-c1')).getAllByRole('button')[2]);
    await screen.findByText('Parent line');
    await user.click(screen.getByRole('button', { name: 'TRẢ LỜI' }));
    expect(screen.getByText(/Trả lời ParentUser/)).toBeInTheDocument();
    const modal = screen.getByRole('heading', { name: 'Bình luận' }).closest('.premium-modal-box');
    await user.click(within(modal).getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByText(/Trả lời ParentUser/)).not.toBeInTheDocument();
    expect(document.getElementById('comment-input')).toHaveAttribute('placeholder', 'Viết bình luận...');
  });

  it('sendComment_Enter_key_triggers_sendComment', async () => {
    const post = makePost();
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(makeResponse(200, []))
      .mockResolvedValueOnce(makeResponse(200, {}, { ok: true }))
      .mockResolvedValueOnce(makeResponse(200, []))
      .mockResolvedValue(makeResponse(200, { posts: [post] }));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-p-c1')).getAllByRole('button')[2]);
    await screen.findByPlaceholderText(/Viết bình luận/);
    const input = document.getElementById('comment-input');
    await user.type(input, 'Via enter');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(
        hoisted.mockApiFetch.mock.calls.some(
          (c) => c[0] === '/social/posts/p-c1/comments' && c[1]?.method === 'POST',
        ),
      ).toBe(true);
    });
  });

  it('renders_nested_replies_from_comment_thread', async () => {
    const post = makePost();
    const thread = [
      {
        id: 'root-c',
        content: 'Top',
        created_at: '2026-02-01T12:05:00.000Z',
        user_info: { full_name: 'U1', avatar_url: null },
        replies: [
          {
            content: 'Nested reply',
            user_info: { full_name: 'U2', avatar_url: null },
          },
        ],
      },
    ];
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(makeResponse(200, thread));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-p-c1')).getAllByRole('button')[2]);
    await screen.findByText('Top');
    expect(screen.getByText('Nested reply')).toBeInTheDocument();
  });

  it('comment_modal_header_close_unmounts_modal', async () => {
    const post = makePost();
    hoisted.mockApiFetch
      .mockResolvedValueOnce(makeResponse(200, { posts: [post] }))
      .mockResolvedValueOnce(makeResponse(200, []));
    const user = userEvent.setup();
    renderFeed();
    await waitForFeedReady();
    await user.click(within(document.getElementById('post-p-c1')).getAllByRole('button')[2]);
    await screen.findByRole('heading', { name: 'Bình luận' });
    const heading = screen.getByRole('heading', { name: 'Bình luận' });
    const closeBtn = heading.parentElement.querySelector('button');
    expect(closeBtn).toBeTruthy();
    await user.click(closeBtn);
    await waitFor(() => expect(screen.queryByPlaceholderText(/Viết bình luận/)).not.toBeInTheDocument());
  });
});
