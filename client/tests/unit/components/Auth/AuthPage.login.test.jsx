import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const hoisted = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  verifyOtp: vi.fn(),
  resendVerificationOtp: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('../../../../src/context/AuthContext.jsx', () => ({
  useAuth: () => ({
    login: hoisted.login,
    register: hoisted.register,
    verifyOtp: hoisted.verifyOtp,
    resendVerificationOtp: hoisted.resendVerificationOtp,
    forgotPassword: hoisted.forgotPassword,
    resetPassword: hoisted.resetPassword,
  }),
}));

import AuthPage from '@/components/Auth/AuthPage.jsx';

describe('AuthPage — login', () => {
  beforeEach(() => {
    hoisted.login.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('submit_calls_login_with_email_and_password', async () => {
    hoisted.login.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.type(document.getElementById('login-email'), 'a@b.c');
    await user.type(document.getElementById('login-password'), 'secret12');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    await waitFor(() => {
      expect(hoisted.login).toHaveBeenCalledWith('a@b.c', 'secret12');
    });
  });

  it('failure_shows_error_message', async () => {
    hoisted.login.mockResolvedValue({ success: false, error: 'Sai mật khẩu' });
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.type(document.getElementById('login-email'), 'a@b.c');
    await user.type(document.getElementById('login-password'), 'wrong');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    expect(await screen.findByText(/Sai mật khẩu/)).toBeInTheDocument();
  });

  it('login_throw_shows_server_connection_error', async () => {
    hoisted.login.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.type(document.getElementById('login-email'), 'a@b.c');
    await user.type(document.getElementById('login-password'), 'p');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    expect(await screen.findByText(/Không thể kết nối đến server/)).toBeInTheDocument();
  });

  it('submit_disabled_while_loading_shows_processing_label', async () => {
    let resolveLogin;
    hoisted.login.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.type(document.getElementById('login-email'), 'a@b.c');
    await user.type(document.getElementById('login-password'), 'p');
    const submit = document.querySelector('form button[type="submit"].btn-primary');
    void user.click(submit);
    expect(await screen.findByRole('button', { name: /Đang xử lý/i })).toBeDisabled();
    resolveLogin({ success: true });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đăng nhập/i })).not.toBeDisabled();
    });
  });

  it('password_toggle_switches_input_type', async () => {
    hoisted.login.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<AuthPage />);
    const pwd = document.getElementById('login-password');
    expect(pwd).toHaveAttribute('type', 'password');
    const eyeBtn = pwd.closest('div')?.querySelector('button[type="button"]');
    expect(eyeBtn).toBeTruthy();
    await user.click(eyeBtn);
    expect(document.getElementById('login-password')).toHaveAttribute('type', 'text');
    await user.click(eyeBtn);
    expect(document.getElementById('login-password')).toHaveAttribute('type', 'password');
  });

  it('forgot_password_link_switches_mode', async () => {
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.click(screen.getByRole('button', { name: /Quên mật khẩu/i }));
    expect(screen.getByRole('heading', { name: /Quên mật khẩu/i })).toBeInTheDocument();
  });
});
