import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

describe('AuthPage — forgot & reset password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.forgotPassword.mockReset();
    hoisted.verifyOtp.mockReset();
    hoisted.resetPassword.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('forgot_empty_email_sets_error_and_no_api', async () => {
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.click(screen.getByRole('button', { name: /Quên mật khẩu/i }));
    const form = document.getElementById('forgot-email').closest('form');
    fireEvent.submit(form);
    expect(await screen.findByText(/Vui lòng nhập email/)).toBeInTheDocument();
    expect(hoisted.forgotPassword).not.toHaveBeenCalled();
  });

  it('forgot_with_email_calls_forgot_and_moves_to_otp', async () => {
    hoisted.forgotPassword.mockResolvedValue({ success: true, message: 'OTP gửi' });
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.click(screen.getByRole('button', { name: /Quên mật khẩu/i }));
    await user.type(document.getElementById('forgot-email'), 'user@test.com');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    await waitFor(() => {
      expect(hoisted.forgotPassword).toHaveBeenCalledWith('user@test.com');
    });
    expect(await screen.findByRole('heading', { name: /Xác thực OTP/i })).toBeInTheDocument();
  });

  it('reset_password_short_password_sets_error', async () => {
    hoisted.forgotPassword.mockResolvedValue({ success: true, message: 'ok' });
    hoisted.verifyOtp.mockResolvedValue({ success: true, message: 'ok' });
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.click(screen.getByRole('button', { name: /Quên mật khẩu/i }));
    await user.type(document.getElementById('forgot-email'), 'u@test.com');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    await screen.findByRole('heading', { name: /Xác thực OTP/i });
    const inputs = screen.getAllByRole('textbox');
    for (let i = 0; i < 6; i++) await user.type(inputs[i], '9');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    await screen.findByRole('heading', { name: /Đặt lại mật khẩu/i });
    const newPwd = document.getElementById('reset-password');
    await user.type(newPwd, 'short');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    expect(await screen.findByText(/Mật khẩu phải có tối thiểu 8 ký tự/)).toBeInTheDocument();
    expect(hoisted.resetPassword).not.toHaveBeenCalled();
  });

  it('reset_password_success_returns_to_login', async () => {
    hoisted.forgotPassword.mockResolvedValue({ success: true, message: 'ok' });
    hoisted.verifyOtp.mockResolvedValue({ success: true, message: 'ok' });
    hoisted.resetPassword.mockResolvedValue({ success: true, message: 'done' });
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.click(screen.getByRole('button', { name: /Quên mật khẩu/i }));
    await user.type(document.getElementById('forgot-email'), 'user2@test.com');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    await screen.findByRole('heading', { name: /Xác thực OTP/i });
    const inputs = screen.getAllByRole('textbox');
    for (let i = 0; i < 6; i++) await user.type(inputs[i], '1');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    await screen.findByRole('heading', { name: /Đặt lại mật khẩu/i });
    await user.type(document.getElementById('reset-password'), 'newpass12');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    await waitFor(() => {
      expect(hoisted.resetPassword).toHaveBeenCalledWith('user2@test.com', '111111', 'newpass12');
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /THNN/i })).toBeInTheDocument();
    });
  });

  it('forgot_failure_shows_error', async () => {
    hoisted.forgotPassword.mockResolvedValue({ success: false, error: 'Không tìm thấy' });
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.click(screen.getByRole('button', { name: /Quên mật khẩu/i }));
    await user.type(document.getElementById('forgot-email'), 'x@test.com');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    expect(await screen.findByText(/Không tìm thấy/)).toBeInTheDocument();
  });
});
