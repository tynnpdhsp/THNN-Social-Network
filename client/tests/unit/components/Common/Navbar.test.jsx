import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { makeResponse } from '../../_fakes/fetch.js';

const hoisted = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockApiFetch: vi.fn(),
  mockResolveImageUrl: vi.fn((url) => url),
  mockGetDefaultAvatar: vi.fn((name) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'U')}`),
}));

vi.mock('../../../../src/context/AuthContext.jsx', () => ({
  useAuth: () => hoisted.mockUseAuth(),
}));

vi.mock('../../../../src/config/api.js', () => ({
  apiFetch: (...args) => hoisted.mockApiFetch(...args),
  resolveImageUrl: (u) => hoisted.mockResolveImageUrl(u),
  getDefaultAvatar: (n) => hoisted.mockGetDefaultAvatar(n),
}));

import Navbar from '@/components/Common/Navbar.jsx';

function setupDefaultFetch() {
  hoisted.mockApiFetch.mockImplementation((path) => {
    if (path === '/notifications/unread-count') {
      return Promise.resolve(makeResponse(200, { unread_count: 0 }));
    }
    if (path === '/messaging/has-unread') {
      return Promise.resolve(makeResponse(200, { has_unread: false }));
    }
    return Promise.resolve(makeResponse(404, {}));
  });
}

describe('Navbar', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    hoisted.mockUseAuth.mockReturnValue({
      user: null,
      logout: mockLogout,
    });
    hoisted.mockApiFetch.mockReset();
    hoisted.mockResolveImageUrl.mockImplementation((url) => url);
    hoisted.mockGetDefaultAvatar.mockImplementation((name) => `avatar:${name || 'U'}`);
    setupDefaultFetch();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders_all_main_tabs_with_ids', () => {
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="feed" setActiveTab={setActiveTab} />);
    expect(document.getElementById('nav-feed')).toBeTruthy();
    expect(document.getElementById('nav-board')).toBeTruthy();
    expect(document.getElementById('nav-shop')).toBeTruthy();
    expect(document.getElementById('nav-docs')).toBeTruthy();
    expect(document.getElementById('nav-timetable')).toBeTruthy();
    expect(document.getElementById('nav-map')).toBeTruthy();
  });

  it('activeTab_feed_styles_active_tab_button', () => {
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="feed" setActiveTab={setActiveTab} />);
    const feedBtn = document.getElementById('nav-feed');
    expect(feedBtn.style.backgroundColor).toBe('var(--ink)');
  });

  it('click_tab_calls_setActiveTab_with_id', async () => {
    const setActiveTab = vi.fn();
    const user = userEvent.setup();
    render(<Navbar activeTab="feed" setActiveTab={setActiveTab} />);
    await user.click(document.getElementById('nav-shop'));
    expect(setActiveTab).toHaveBeenCalledWith('shop');
  });

  it('click_logo_when_activeTab_feed_calls_reload', async () => {
    const setActiveTab = vi.fn();
    const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<Navbar activeTab="feed" setActiveTab={setActiveTab} />);
    await user.click(screen.getByAltText('Logo').closest('.logo'));
    expect(reload).toHaveBeenCalled();
    expect(setActiveTab).not.toHaveBeenCalled();
    reload.mockRestore();
  });

  it('click_logo_when_not_feed_calls_setActiveTab_feed', async () => {
    const setActiveTab = vi.fn();
    const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<Navbar activeTab="shop" setActiveTab={setActiveTab} />);
    await user.click(screen.getByAltText('Logo').closest('.logo'));
    expect(setActiveTab).toHaveBeenCalledWith('feed');
    expect(reload).not.toHaveBeenCalled();
    reload.mockRestore();
  });

  it('without_user_does_not_fetch_counts', async () => {
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="feed" setActiveTab={setActiveTab} />);
    await waitFor(() => {
      expect(hoisted.mockApiFetch).not.toHaveBeenCalled();
    });
  });

  it('with_user_fetches_unread_count_and_has_unread', async () => {
    hoisted.mockUseAuth.mockReturnValue({
      user: { full_name: 'A', email: 'a@b.c', role: 'user', avatar_url: null },
      logout: mockLogout,
    });
    hoisted.mockApiFetch.mockImplementation((path) => {
      if (path === '/notifications/unread-count') {
        return Promise.resolve(makeResponse(200, { unread_count: 3 }));
      }
      if (path === '/messaging/has-unread') {
        return Promise.resolve(makeResponse(200, { has_unread: true }));
      }
      return Promise.resolve(makeResponse(404, {}));
    });
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="feed" setActiveTab={setActiveTab} />);
    await waitFor(() => {
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/notifications/unread-count');
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/messaging/has-unread');
    });
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('unread_count_over_9_shows_9plus', async () => {
    hoisted.mockUseAuth.mockReturnValue({
      user: { full_name: 'A', email: 'a@b.c', role: 'user', avatar_url: null },
      logout: mockLogout,
    });
    hoisted.mockApiFetch.mockImplementation((path) => {
      if (path === '/notifications/unread-count') {
        return Promise.resolve(makeResponse(200, { unread_count: 12 }));
      }
      if (path === '/messaging/has-unread') {
        return Promise.resolve(makeResponse(200, { has_unread: false }));
      }
      return Promise.resolve(makeResponse(404, {}));
    });
    render(<Navbar activeTab="feed" setActiveTab={vi.fn()} />);
    expect(await screen.findByText('9+')).toBeInTheDocument();
  });

  it('has_unread_true_shows_dot_on_messages_button', async () => {
    hoisted.mockUseAuth.mockReturnValue({
      user: { full_name: 'A', email: 'a@b.c', role: 'user', avatar_url: null },
      logout: mockLogout,
    });
    hoisted.mockApiFetch.mockImplementation((path) => {
      if (path === '/notifications/unread-count') {
        return Promise.resolve(makeResponse(200, { unread_count: 0 }));
      }
      if (path === '/messaging/has-unread') {
        return Promise.resolve(makeResponse(200, { has_unread: true }));
      }
      return Promise.resolve(makeResponse(404, {}));
    });
    const { container } = render(<Navbar activeTab="feed" setActiveTab={vi.fn()} />);
    await waitFor(() => {
      const msgBtn = document.getElementById('nav-messages');
      expect(msgBtn.querySelectorAll('span').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('refreshNotifs_event_refetches', async () => {
    hoisted.mockUseAuth.mockReturnValue({
      user: { id: 1, full_name: 'A', email: 'a@b.c', role: 'user', avatar_url: null },
      logout: mockLogout,
    });
    hoisted.mockApiFetch.mockImplementation((path) => {
      if (path === '/notifications/unread-count') {
        return Promise.resolve(makeResponse(200, { unread_count: 1 }));
      }
      if (path === '/messaging/has-unread') {
        return Promise.resolve(makeResponse(200, { has_unread: false }));
      }
      return Promise.resolve(makeResponse(404, {}));
    });
    render(<Navbar activeTab="feed" setActiveTab={vi.fn()} />);
    await waitFor(() => expect(hoisted.mockApiFetch).toHaveBeenCalled());
    const callsAfterMount = hoisted.mockApiFetch.mock.calls.length;
    window.dispatchEvent(new CustomEvent('refreshNotifs'));
    await waitFor(() => {
      expect(hoisted.mockApiFetch.mock.calls.length).toBeGreaterThan(callsAfterMount);
    });
  });

  it('refreshMsgs_event_refetches', async () => {
    hoisted.mockUseAuth.mockReturnValue({
      user: { id: 1, full_name: 'A', email: 'a@b.c', role: 'user', avatar_url: null },
      logout: mockLogout,
    });
    setupDefaultFetch();
    render(<Navbar activeTab="feed" setActiveTab={vi.fn()} />);
    await waitFor(() => expect(hoisted.mockApiFetch).toHaveBeenCalled());
    const n = hoisted.mockApiFetch.mock.calls.length;
    window.dispatchEvent(new CustomEvent('refreshMsgs'));
    await waitFor(() => expect(hoisted.mockApiFetch.mock.calls.length).toBeGreaterThan(n));
  });

  it('poll_interval_30s_triggers_additional_fetch', async () => {
    vi.useFakeTimers();
    hoisted.mockUseAuth.mockReturnValue({
      user: { id: 1, full_name: 'A', email: 'a@b.c', role: 'user', avatar_url: null },
      logout: mockLogout,
    });
    setupDefaultFetch();
    render(<Navbar activeTab="feed" setActiveTab={vi.fn()} />);
    await vi.waitFor(() => expect(hoisted.mockApiFetch.mock.calls.length).toBeGreaterThanOrEqual(2));
    const afterMount = hoisted.mockApiFetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30000);
    expect(hoisted.mockApiFetch.mock.calls.length).toBeGreaterThan(afterMount);
  });

  it('user_menu_shows_profile_and_settings', async () => {
    hoisted.mockUseAuth.mockReturnValue({
      user: { full_name: 'User One', email: 'u@e.com', role: 'user', avatar_url: null },
      logout: mockLogout,
    });
    setupDefaultFetch();
    const user = userEvent.setup();
    render(<Navbar activeTab="feed" setActiveTab={vi.fn()} />);
    await user.click(screen.getByAltText('avatar'));
    expect(screen.getByText('Trang cá nhân')).toBeInTheDocument();
    expect(screen.getByText('Cài đặt')).toBeInTheDocument();
    expect(screen.queryByText('Quản trị')).not.toBeInTheDocument();
  });

  it('admin_user_sees_admin_menu_item', async () => {
    hoisted.mockUseAuth.mockReturnValue({
      user: { full_name: 'Admin', email: 'a@e.com', role: 'admin', avatar_url: null },
      logout: mockLogout,
    });
    setupDefaultFetch();
    const user = userEvent.setup();
    render(<Navbar activeTab="feed" setActiveTab={vi.fn()} />);
    await user.click(screen.getByAltText('avatar'));
    expect(screen.getByText('Quản trị')).toBeInTheDocument();
  });

  it('click_logout_calls_logout_from_context', async () => {
    hoisted.mockUseAuth.mockReturnValue({
      user: { full_name: 'U', email: 'u@e.com', role: 'user', avatar_url: null },
      logout: mockLogout,
    });
    setupDefaultFetch();
    const user = userEvent.setup();
    render(<Navbar activeTab="feed" setActiveTab={vi.fn()} />);
    await user.click(screen.getByAltText('avatar'));
    await user.click(screen.getByText('Đăng xuất'));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('unmount_removes_refresh_event_listeners', () => {
    const rm = vi.spyOn(window, 'removeEventListener');
    hoisted.mockUseAuth.mockReturnValue({
      user: { full_name: 'U', email: 'u@e.com', role: 'user', avatar_url: null },
      logout: mockLogout,
    });
    setupDefaultFetch();
    const { unmount } = render(<Navbar activeTab="feed" setActiveTab={vi.fn()} />);
    unmount();
    expect(rm).toHaveBeenCalledWith('refreshNotifs', expect.any(Function));
    expect(rm).toHaveBeenCalledWith('refreshMsgs', expect.any(Function));
    rm.mockRestore();
  });

  it('notifications_and_messages_buttons_switch_tab', async () => {
    const setActiveTab = vi.fn();
    const user = userEvent.setup();
    render(<Navbar activeTab="feed" setActiveTab={setActiveTab} />);
    await user.click(document.getElementById('nav-notifications'));
    expect(setActiveTab).toHaveBeenCalledWith('notifications');
    await user.click(document.getElementById('nav-messages'));
    expect(setActiveTab).toHaveBeenCalledWith('messaging');
    await user.click(document.getElementById('nav-friends'));
    expect(setActiveTab).toHaveBeenCalledWith('friends');
  });

  it('user_menu_item_profile_calls_setActiveTab', async () => {
    const setActiveTab = vi.fn();
    hoisted.mockUseAuth.mockReturnValue({
      user: { full_name: 'U', email: 'u@e.com', role: 'user', avatar_url: null },
      logout: mockLogout,
    });
    setupDefaultFetch();
    const user = userEvent.setup();
    render(<Navbar activeTab="feed" setActiveTab={setActiveTab} />);
    await user.click(screen.getByAltText('avatar'));
    await user.click(screen.getByText('Trang cá nhân'));
    expect(setActiveTab).toHaveBeenCalledWith('profile');
  });
});
