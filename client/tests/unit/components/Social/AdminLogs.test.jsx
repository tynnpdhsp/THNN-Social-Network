import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import AdminLogs from '@/components/Social/AdminLogs.jsx';

describe('AdminLogs', () => {
  it('renders_log_rows', () => {
    const logs = [
      { id: 'l1', action: 'LOGIN', severity: 'info', created_at: '2026-01-01T08:00:00.000Z', payload: { x: 1 } },
    ];
    render(<AdminLogs logs={logs} />);
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  it('empty_logs_shows_Trống', () => {
    render(<AdminLogs logs={[]} />);
    expect(screen.getByText('Trống')).toBeInTheDocument();
  });
});
