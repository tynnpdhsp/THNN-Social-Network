import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { useAuth } from '../../../src/context/AuthContext.jsx';
import { useConfirm } from '../../../src/components/Common/ConfirmDialog.jsx';
import { renderWithAuth, renderWithConfirm } from './auth.jsx';
import { mockFetchByPath, makeResponse, restoreFetch } from './fetch.js';

function AuthProbe() {
  const { user, token, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="token">{token ?? 'none'}</span>
      <span data-testid="user">{user ? JSON.stringify(user) : 'none'}</span>
    </div>
  );
}

function ConfirmProbe() {
  const confirm = useConfirm();
  const [result, setResult] = useState('');
  return (
    <div>
      <button
        type="button"
        onClick={() => void confirm({ title: 'T', message: 'M' }).then((v) => setResult(String(v)))}
      >
        ask
      </button>
      <span data-testid="confirm-result">{result}</span>
    </div>
  );
}

describe('renderWithAuth + AuthProvider', () => {
  afterEach(() => {
    restoreFetch();
  });

  it('useAuth_outside_provider_throws', () => {
    expect(() => render(<AuthProbe />)).toThrow(/useAuth must be used within AuthProvider/);
  });

  it('no_token_profile_not_fetched_loading_becomes_false', async () => {
    renderWithAuth(<AuthProbe />);
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('token').textContent).toBe('none');
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('valid_token_sets_user_from_account_me', async () => {
    localStorage.setItem('token', 'fake.jwt.here');
    mockFetchByPath({
      'GET /api/v1/account/me': makeResponse(200, { id: 'u1', email: 'a@b.c', full_name: 'A' }),
    });
    renderWithAuth(<AuthProbe />);
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toContain('a@b.c');
    expect(screen.getByTestId('token').textContent).toBe('fake.jwt.here');
  });

  it('invalid_token_response_401_clears_storage_user_and_token_state', async () => {
    localStorage.setItem('token', 'bad');
    mockFetchByPath({
      'GET /api/v1/account/me': makeResponse(401, { detail: 'nope' }),
    });
    renderWithAuth(<AuthProbe />);
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('user').textContent).toBe('none');
    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe('none');
    });
  });

  it('fetch_profile_reject_clears_token', async () => {
    localStorage.setItem('token', 'tok');
    mockFetchByPath({
      'GET /api/v1/account/me': () => Promise.reject(new Error('network')),
    });
    renderWithAuth(<AuthProbe />);
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(localStorage.getItem('token')).toBeNull();
    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe('none');
    });
  });

  it('renderWithAuth_withConfirm_true_wraps_both_providers', async () => {
    mockFetchByPath({
      'GET /api/v1/account/me': makeResponse(200, { id: 'c1', email: 'c@test', full_name: 'C' }),
    });
    localStorage.setItem('token', 't');
    function Combo() {
      const { user, loading } = useAuth();
      const confirm = useConfirm();
      const [r, setR] = useState('');
      if (loading) return <span>loading</span>;
      return (
        <div>
          <span data-testid="email">{user?.email}</span>
          <button
            type="button"
            onClick={() => void confirm({ title: 'Q', message: '?' }).then((v) => setR(String(v)))}
          >
            ask
          </button>
          <span data-testid="cr">{r}</span>
        </div>
      );
    }
    const user = userEvent.setup();
    renderWithAuth(<Combo />, { withConfirm: true });
    await waitFor(() => {
      expect(screen.getByTestId('email').textContent).toBe('c@test');
    });
    await user.click(screen.getByRole('button', { name: /ask/i }));
    await user.click(await screen.findByRole('button', { name: /^Xác nhận$/i }));
    await waitFor(() => expect(screen.getByTestId('cr').textContent).toBe('true'), { timeout: 5000 });
  });
});

describe('renderWithConfirm + ConfirmProvider', () => {
  it('useConfirm_outside_provider_throws', () => {
    expect(() => render(<ConfirmProbe />)).toThrow(/useConfirm must be used within ConfirmProvider/);
  });

  it('confirm_resolves_true_after_primary_click_and_dialog_timers', async () => {
    const user = userEvent.setup();
    renderWithConfirm(<ConfirmProbe />);
    await user.click(screen.getByRole('button', { name: /ask/i }));
    const confirmBtn = await screen.findByRole('button', { name: /^Xác nhận$/i });
    await user.click(confirmBtn);
    await waitFor(
      () => {
        expect(screen.getByTestId('confirm-result').textContent).toBe('true');
      },
      { timeout: 5000 },
    );
  });

  it('confirm_resolves_false_after_cancel_click_and_dialog_timers', async () => {
    const user = userEvent.setup();
    renderWithConfirm(<ConfirmProbe />);
    await user.click(screen.getByRole('button', { name: /ask/i }));
    const cancelButtons = await screen.findAllByRole('button', { name: /^Hủy$/i });
    expect(cancelButtons.length).toBeGreaterThanOrEqual(1);
    await user.click(cancelButtons[0]);
    await waitFor(
      () => {
        expect(screen.getByTestId('confirm-result').textContent).toBe('false');
      },
      { timeout: 5000 },
    );
  });

  it('confirm_resolves_false_on_escape_after_timers', async () => {
    const user = userEvent.setup();
    renderWithConfirm(<ConfirmProbe />);
    await user.click(screen.getByRole('button', { name: /ask/i }));
    await screen.findByText('M');
    await user.keyboard('{Escape}');
    await waitFor(
      () => {
        expect(screen.getByTestId('confirm-result').textContent).toBe('false');
      },
      { timeout: 5000 },
    );
  });
});
