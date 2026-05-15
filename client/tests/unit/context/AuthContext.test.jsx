import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext.jsx';
import { installMockWebSocket } from '../_fakes/websocket.js';

vi.mock('@/config/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

import { apiFetch } from '@/config/api.js';
import { makeResponse } from '../_fakes/fetch.js';

function MountProbe() {
  const { user, token, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="token">{token ?? 'none'}</span>
      <span data-testid="user">{user ? JSON.stringify(user) : 'none'}</span>
    </div>
  );
}

function ActionsProbe() {
  const { login, register, verifyOtp, resendVerificationOtp, forgotPassword, resetPassword, logout } =
    useAuth();
  const [out, setOut] = useState('');
  return (
    <div>
      <button type="button" onClick={() => void login('a@b.c', 'pw').then((r) => setOut(JSON.stringify(r)))}>
        login
      </button>
      <button type="button" onClick={() => void register({ email: 'e' }).then((r) => setOut(JSON.stringify(r)))}>
        register
      </button>
      <button
        type="button"
        onClick={() => void verifyOtp('e', '123456', 'register').then((r) => setOut(JSON.stringify(r)))}
      >
        verifyOtp
      </button>
      <button type="button" onClick={() => void resendVerificationOtp('e').then((r) => setOut(JSON.stringify(r)))}>
        resend
      </button>
      <button type="button" onClick={() => void forgotPassword('e').then((r) => setOut(JSON.stringify(r)))}>
        forgot
      </button>
      <button
        type="button"
        onClick={() => void resetPassword('e', 'c', 'newpass12').then((r) => setOut(JSON.stringify(r)))}
      >
        reset
      </button>
      <button type="button" onClick={() => logout()}>
        logout
      </button>
      <span data-testid="out">{out}</span>
    </div>
  );
}

describe('AuthContext', () => {
  let restoreWs;

  beforeEach(() => {
    restoreWs = installMockWebSocket();
    vi.mocked(apiFetch).mockReset();
  });

  afterEach(() => {
    restoreWs?.();
    vi.clearAllMocks();
  });

  it('useAuth_outside_AuthProvider_throws', () => {
    function Bad() {
      useAuth();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/useAuth must be used within AuthProvider/);
  });

  it('mount_no_token_does_not_call_account_me_loading_becomes_false', async () => {
    render(
      <AuthProvider>
        <MountProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(screen.getByTestId('token').textContent).toBe('none');
  });

  it('mount_with_token_account_me_ok_sets_user', async () => {
    localStorage.setItem('token', 't1');
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeResponse(200, { id: 'u1', email: 'u@test', full_name: 'U' }),
    );
    render(
      <AuthProvider>
        <MountProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(apiFetch).toHaveBeenCalledWith('/account/me');
    expect(screen.getByTestId('user').textContent).toContain('u@test');
  });

  it('mount_with_token_4xx_clears_token_and_user', async () => {
    localStorage.setItem('token', 'bad');
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(401, { detail: 'x' }));
    render(
      <AuthProvider>
        <MountProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('token').textContent).toBe('none');
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('mount_with_token_fetch_rejection_clears_token', async () => {
    localStorage.setItem('token', 't2');
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('net'));
    render(
      <AuthProvider>
        <MountProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('login_success_sets_token_via_localStorage_and_returns_success', async () => {
    localStorage.removeItem('token');
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(makeResponse(200, { access_token: 'jwt-new', token_type: 'bearer' }))
      .mockResolvedValueOnce(makeResponse(200, { id: 'u', email: 'a@b.c' }));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: /^login$/i }));
    await waitFor(() => {
      expect(screen.getByTestId('out').textContent).toContain('"success":true');
    });
    expect(localStorage.getItem('token')).toBe('jwt-new');
    const call = vi.mocked(apiFetch).mock.calls.find((c) => c[0] === '/account/login');
    expect(call).toBeDefined();
    const [, init] = call;
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect([...init.body.entries()]).toEqual(
      expect.arrayContaining([
        ['username', 'a@b.c'],
        ['password', 'pw'],
      ]),
    );
  });

  it('login_failure_uses_extractError_detail_string', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: 'bad creds' }));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: /^login$/i }));
    await waitFor(() => {
      const t = screen.getByTestId('out').textContent;
      expect(t).toContain('"success":false');
      expect(t).toContain('bad creds');
    });
  });

  it('login_failure_detail_array_joins_msg_with_semicolon', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeResponse(422, { detail: [{ msg: 'a' }, { msg: 'b', x: 1 }] }),
    );
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: /^login$/i }));
    await waitFor(() => {
      expect(screen.getByTestId('out').textContent).toContain('a; b');
    });
  });

  it('login_failure_detail_object_uses_msg', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: { msg: 'field wrong' } }));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: /^login$/i }));
    await waitFor(() => {
      expect(screen.getByTestId('out').textContent).toContain('field wrong');
    });
  });

  it('login_failure_no_detail_uses_fallback_message', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, {}));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: /^login$/i }));
    await waitFor(() => {
      expect(screen.getByTestId('out').textContent).toContain('Đăng nhập thất bại');
    });
  });

  it('login_failure_detail_object_without_msg_JSON_stringifies', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: { code: 9 } }));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: /^login$/i }));
    await waitFor(() => {
      const { error } = JSON.parse(screen.getByTestId('out').textContent);
      expect(error).toBe(JSON.stringify({ code: 9 }));
    });
  });

  it('login_failure_detail_array_element_without_msg_JSON_stringifies', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeResponse(400, { detail: [{}, { msg: 'second' }] }),
    );
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: /^login$/i }));
    await waitFor(() => {
      expect(screen.getByTestId('out').textContent).toContain('{}');
      expect(screen.getByTestId('out').textContent).toContain('second');
    });
  });

  it('register_ok_includes_message_in_result', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { message: 'ok reg' }));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: /^register$/i }));
    await waitFor(() => {
      const t = screen.getByTestId('out').textContent;
      expect(t).toContain('"success":true');
      expect(t).toContain('ok reg');
    });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      '/account/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'e' }),
      }),
    );
  });

  it('register_error_extractError', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: 'dup' }));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: /^register$/i }));
    await waitFor(() => {
      expect(screen.getByTestId('out').textContent).toContain('dup');
    });
  });

  it('verifyOtp_calls_correct_path_and_JSON', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { message: 'verified' }));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: /^verifyOtp$/i }));
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      '/account/verify-otp',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'e', code: '123456', purpose: 'register' }),
      }),
    );
  });

  it('resendVerificationOtp_path_and_body', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { message: 'sent' }));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: /^resend$/i }));
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      '/account/register/resend-verification',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'e', purpose: 'register' }),
      }),
    );
  });

  it('forgotPassword_path_and_body', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { message: 'otp sent' }));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: /^forgot$/i }));
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      '/account/forgot-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'e', purpose: 'reset_password' }),
      }),
    );
  });

  it('resetPassword_path_and_body', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { message: 'reset ok' }));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      '/account/reset-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'e', code: 'c', new_password: 'newpass12' }),
      }),
    );
  });

  it('logout_clears_localStorage_user_token_state', async () => {
    localStorage.setItem('token', 'tok');
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { id: '1', email: 'x@y.z' }));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MountProbe />
        <ActionsProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('token').textContent).toBe('tok');
    await user.click(screen.getByRole('button', { name: /^logout$/i }));
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('token').textContent).toBe('none');
    expect(screen.getByTestId('user').textContent).toBe('none');
  });
});
