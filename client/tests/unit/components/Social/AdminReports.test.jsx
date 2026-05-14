import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import AdminReports from '@/components/Social/AdminReports.jsx';

describe('AdminReports', () => {
  it('refresh_button_calls_loadAll', async () => {
    const loadAll = vi.fn();
    const user = userEvent.setup();
    render(
      <AdminReports
        reports={[]}
        reportFilter="pending"
        setReportFilter={vi.fn()}
        loadAll={loadAll}
        setResolveId={vi.fn()}
        onViewProfile={vi.fn()}
      />,
    );
    const refresh = document.querySelector('button.btn-secondary');
    expect(refresh).toBeTruthy();
    await user.click(refresh);
    expect(loadAll).toHaveBeenCalled();
  });
});
