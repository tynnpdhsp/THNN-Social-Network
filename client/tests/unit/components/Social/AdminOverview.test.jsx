import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import AdminOverview from '@/components/Social/AdminOverview.jsx';

describe('AdminOverview', () => {
  it('renders_stat_cards_from_props', () => {
    render(
      <AdminOverview
        stats={{ total_users: 3, total_posts: 10, pending_reports: 2, active_users_24h: 1, total_revenue: 1000, total_banned_users: 0 }}
        reports={[]}
        logs={[]}
        setActiveSection={vi.fn()}
        setResolveId={vi.fn()}
        onViewProfile={vi.fn()}
      />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});
