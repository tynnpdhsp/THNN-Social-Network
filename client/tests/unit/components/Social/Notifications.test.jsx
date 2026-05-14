import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { makeResponse } from '../../_fakes/fetch.js';

const hoisted = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: (...a) => hoisted.toastSuccess(...a) },
}));

vi.mock('@/config/api.js', () => ({
  apiFetch: (...a) => hoisted.mockApiFetch(...a),
}));

import Notifications from '@/components/Social/Notifications.jsx';
import { ConfirmProvider } from '@/components/Common/ConfirmDialog.jsx';

describe('Notifications', () => {
  beforeEach(() => {
    hoisted.mockApiFetch.mockReset();
    hoisted.toastSuccess.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loadNotifs_GETs_notifications', async () => {
    hoisted.mockApiFetch.mockResolvedValue(
      makeResponse(200, { notifications: [], unread_count: 0 }),
    );
    render(
      <ConfirmProvider>
        <Notifications onViewProfile={vi.fn()} onNavigate={vi.fn()} />
      </ConfirmProvider>,
    );
    await waitFor(() => expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/notifications'));
  });

  it('markAllRead_PUTs_read_all', async () => {
    hoisted.mockApiFetch.mockResolvedValue(makeResponse(200, { notifications: [], unread_count: 0 }));
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <Notifications onViewProfile={vi.fn()} onNavigate={vi.fn()} />
      </ConfirmProvider>,
    );
    await waitFor(() => screen.getByText(/Đọc tất cả/i));
    await user.click(screen.getByText(/Đọc tất cả/i));
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/notifications/read-all', { method: 'PUT' }),
    );
  });
});
