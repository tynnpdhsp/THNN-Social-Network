import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const auth = vi.hoisted(() => ({
  user: null,
  loading: true,
}));

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: auth.user,
    loading: auth.loading,
    token: auth.user ? 'tok' : null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  }),
}));

vi.mock('react-hot-toast', () => ({
  Toaster: () => <div data-testid="toaster" />,
  default: {},
}));

vi.mock('@/components/Auth/AuthPage', () => ({
  default: () => <div data-testid="auth-page">auth</div>,
}));

vi.mock('@/components/Common/Navbar', () => ({
  default: ({ activeTab, setActiveTab }) => (
    <nav data-testid="navbar">
      <span data-testid="nav-active">{activeTab}</span>
      <button type="button" onClick={() => setActiveTab('feed')}>
        tab-feed
      </button>
      <button type="button" onClick={() => setActiveTab('shop')}>
        tab-shop
      </button>
      <button type="button" onClick={() => setActiveTab('profile')}>
        tab-profile
      </button>
      <button type="button" onClick={() => setActiveTab('messaging')}>
        tab-messaging
      </button>
      <button type="button" onClick={() => setActiveTab('timetable')}>
        tab-timetable
      </button>
    </nav>
  ),
}));

vi.mock('@/components/Social/Feed', () => ({
  default: ({ onViewProfile }) => (
    <div data-testid="feed">
      <button type="button" onClick={() => onViewProfile('u-remote')}>
        view-profile
      </button>
    </div>
  ),
}));

vi.mock('@/components/Social/Board', () => ({ default: () => <div data-testid="board" /> }));
vi.mock('@/components/Social/Friends', () => ({ default: () => <div data-testid="friends" /> }));
vi.mock('@/components/Social/Notifications', () => ({ default: () => <div data-testid="notifications" /> }));
vi.mock('@/components/Social/Settings', () => ({ default: () => <div data-testid="settings" /> }));
vi.mock('@/components/Social/AdminPanel', () => ({ default: () => <div data-testid="admin" /> }));

vi.mock('@/components/Social/Profile', () => ({
  default: ({ targetUserId, onStartChat }) => (
    <div data-testid="profile">
      <span data-testid="profile-target">{targetUserId ?? 'me'}</span>
      <button type="button" onClick={() => onStartChat({ id: 'peer-1', name: 'P' })}>
        start-chat
      </button>
    </div>
  ),
}));

vi.mock('@/components/Social/Messaging', () => ({
  default: ({ preselectedUser }) => (
    <div data-testid="messaging">{preselectedUser ? `to:${preselectedUser.id}` : 'none'}</div>
  ),
}));

vi.mock('@/components/Shop/Shop', () => ({ default: () => <div data-testid="shop" /> }));
vi.mock('@/components/StudyDocs/StudyDocs', () => ({ default: () => <div data-testid="docs" /> }));
vi.mock('@/components/Timetable/Timetable', () => ({ default: () => <div data-testid="timetable" /> }));
vi.mock('@/components/Map/Map', () => ({ default: () => <div data-testid="map" /> }));

import App from '@/App.jsx';

function installMockLocation(initialHash = '') {
  let h = initialHash;
  if (h && !h.startsWith('#')) h = `#${h}`;
  delete window.location;
  window.location = {
    pathname: '/',
    search: '',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    protocol: 'http:',
    origin: 'http://localhost:3000',
    get href() {
      return `http://localhost:3000/${h ? h.slice(1) : ''}`;
    },
    get hash() {
      return h || '';
    },
    set hash(v) {
      h = v.startsWith('#') ? v : `#${v}`;
    },
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  };
}

describe('App — routing & shell', () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = true;
    installMockLocation('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loading_true_shows_spinner_not_navbar', () => {
    auth.loading = true;
    auth.user = { id: 1 };
    const { container } = render(<App />);
    expect(container.textContent).not.toContain('tab-feed');
    expect(container.innerHTML).toMatch(/spin|100vh/i);
  });

  it('loading_false_user_null_renders_AuthPage', () => {
    auth.loading = false;
    auth.user = null;
    render(<App />);
    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
  });

  it('user_logged_in_renders_Navbar_and_default_Feed', () => {
    auth.loading = false;
    auth.user = { id: 1 };
    render(<App />);
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('feed')).toBeInTheDocument();
    expect(screen.getByTestId('nav-active')).toHaveTextContent('feed');
  });

  it('initial_hash_shop_renders_Shop', () => {
    installMockLocation('#shop');
    auth.loading = false;
    auth.user = { id: 1 };
    render(<App />);
    expect(screen.getByTestId('shop')).toBeInTheDocument();
    expect(screen.getByTestId('nav-active')).toHaveTextContent('shop');
  });

  it('initial_invalid_hash_falls_back_to_feed', () => {
    installMockLocation('#___bad___');
    auth.loading = false;
    auth.user = { id: 1 };
    render(<App />);
    expect(screen.getByTestId('feed')).toBeInTheDocument();
    expect(screen.getByTestId('nav-active')).toHaveTextContent('feed');
  });

  it('handleSetTab_feed_uses_history_pushState_to_strip_hash', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(window.history, 'pushState');
    installMockLocation('#shop');
    auth.loading = false;
    auth.user = { id: 1 };
    render(<App />);
    await user.click(screen.getByText('tab-feed'));
    expect(spy).toHaveBeenCalled();
  });

  it('handleSetTab_non_feed_sets_location_hash', async () => {
    const user = userEvent.setup();
    installMockLocation('');
    auth.loading = false;
    auth.user = { id: 1 };
    render(<App />);
    await user.click(screen.getByText('tab-shop'));
    expect(window.location.hash).toBe('#shop');
  });

  it('onViewProfile_sets_target_and_switches_to_profile', async () => {
    const user = userEvent.setup();
    auth.loading = false;
    auth.user = { id: 1 };
    render(<App />);
    await user.click(screen.getByText('view-profile'));
    expect(screen.getByTestId('profile-target')).toHaveTextContent('u-remote');
    expect(screen.getByTestId('nav-active')).toHaveTextContent('profile');
  });

  it('handleSetTab_profile_clears_viewingUserId', async () => {
    const user = userEvent.setup();
    auth.loading = false;
    auth.user = { id: 1 };
    render(<App />);
    await user.click(screen.getByText('view-profile'));
    expect(screen.getByTestId('profile-target')).toHaveTextContent('u-remote');
    await user.click(screen.getByText('tab-profile'));
    expect(screen.getByTestId('profile-target')).toHaveTextContent('me');
  });

  it('onStartChat_sets_chatTarget_and_switches_to_messaging', async () => {
    const user = userEvent.setup();
    auth.loading = false;
    auth.user = { id: 1 };
    render(<App />);
    await user.click(screen.getByText('tab-profile'));
    await user.click(screen.getByText('start-chat'));
    expect(screen.getByTestId('messaging')).toHaveTextContent('to:peer-1');
    expect(screen.getByTestId('nav-active')).toHaveTextContent('messaging');
  });

  it('hashchange_event_updates_active_tab', async () => {
    auth.loading = false;
    auth.user = { id: 1 };
    render(<App />);
    expect(screen.getByTestId('feed')).toBeInTheDocument();
    await act(async () => {
      window.location.hash = '#timetable';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('timetable')).toBeInTheDocument();
      expect(screen.getByTestId('nav-active')).toHaveTextContent('timetable');
    });
  });

  it('mounts_Toaster_and_ConfirmProvider_smoke', () => {
    auth.loading = false;
    auth.user = { id: 1 };
    const { container } = render(<App />);
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
    expect(container.querySelector('.App')).toBeTruthy();
  });
});
