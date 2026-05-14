import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const hoisted = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => hoisted.mockUseAuth(),
}));

import AdminUsers from '@/components/Social/AdminUsers.jsx';

describe('AdminUsers', () => {
  beforeEach(() => {
    hoisted.mockUseAuth.mockReturnValue({ user: { id: 'admin', role: 'admin' } });
  });

  it('filter_input_narrows_list_by_name', async () => {
    const users = [
      { id: '1', full_name: 'Alpha User', email: 'a@x.com', is_locked: false, role: 'student' },
      { id: '2', full_name: 'Beta', email: 'b@x.com', is_locked: false, role: 'student' },
    ];
    const user = userEvent.setup();
    render(
      <AdminUsers
        users={users}
        userFilter=""
        setUserFilter={vi.fn()}
        loadAll={vi.fn()}
        onViewProfile={vi.fn()}
        onUnlockUser={vi.fn()}
        onUpdateRole={vi.fn()}
        onLockUserSubmit={vi.fn()}
      />,
    );
    const search = screen.getByPlaceholderText(/Tìm theo tên, email/);
    await user.type(search, 'Beta');
    await waitFor(() => expect(screen.getByText('Beta')).toBeInTheDocument());
    expect(screen.queryByText('Alpha User')).not.toBeInTheDocument();
  });
});
