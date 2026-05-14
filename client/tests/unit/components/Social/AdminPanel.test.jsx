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

import AdminPanel from '@/components/Social/AdminPanel.jsx';

describe('AdminPanel', () => {
  beforeEach(() => {
    hoisted.mockApiFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loadAll_fetches_overview_reports_users_logs', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path) => {
      if (path === '/admin/stats/overview') return makeResponse(200, { total_users: 1 });
      if (path.startsWith('/admin/reports')) return makeResponse(200, { reports: [] });
      if (path.startsWith('/admin/users')) return makeResponse(200, { users: [] });
      if (path.startsWith('/admin/audit-logs')) return makeResponse(200, { logs: [] });
      return makeResponse(404, {});
    });
    render(<AdminPanel onViewProfile={vi.fn()} />);
    await waitFor(() => {
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/admin/stats/overview');
      expect(hoisted.mockApiFetch.mock.calls.some((c) => String(c[0]).startsWith('/admin/reports'))).toBe(true);
      expect(hoisted.mockApiFetch.mock.calls.some((c) => String(c[0]).startsWith('/admin/users'))).toBe(true);
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith('/admin/audit-logs?limit=20');
    });
    await screen.findByText(/Quản trị hệ thống/);
  });

  it('resolve_modal_POSTs_admin_reports_resolve', async () => {
    hoisted.mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/admin/stats/overview') return makeResponse(200, { pending_reports: 1 });
      if (path.startsWith('/admin/reports')) return makeResponse(200, { reports: [{ id: 'r1', status: 'pending', target_type: 'post', reason: 'spam', reporter_name: 'A' }] });
      if (path.startsWith('/admin/users')) return makeResponse(200, { users: [] });
      if (path.startsWith('/admin/audit-logs')) return makeResponse(200, { logs: [] });
      if (path === '/admin/reports/r1/resolve' && init?.method === 'POST') return makeResponse(200, {});
      return makeResponse(404, {});
    });
    const user = userEvent.setup();
    render(<AdminPanel onViewProfile={vi.fn()} />);
    await screen.findByText(/Quản trị hệ thống/);
    await user.click(screen.getByRole('button', { name: /Báo cáo/i }));
    await user.click(await screen.findByRole('button', { name: 'GIẢI QUYẾT' }));
    await screen.findByRole('heading', { name: 'Xử lý vi phạm' });
    await user.click(screen.getByRole('button', { name: /Bỏ qua báo cáo/i }));
    await waitFor(() =>
      expect(hoisted.mockApiFetch).toHaveBeenCalledWith(
        '/admin/reports/r1/resolve',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'dismiss' }),
        }),
      ),
    );
  });
});
