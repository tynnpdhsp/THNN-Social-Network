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

describe('AuthPage — register', () => {
  beforeEach(() => {
    hoisted.register.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function goRegister(user) {
    await user.click(screen.getByRole('button', { name: /Đăng ký/i }));
  }

  it('password_mismatch_sets_error_and_does_not_call_register', async () => {
    const user = userEvent.setup();
    render(<AuthPage />);
    await goRegister(user);
    await user.type(document.getElementById('reg-name'), 'Nguyen A');
    await user.type(document.getElementById('reg-email'), 'e@test.com');
    await user.type(document.getElementById('reg-phone'), '0901234567');
    await user.type(document.getElementById('reg-password'), 'password12');
    await user.type(document.getElementById('reg-confirm'), 'password99');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    expect(hoisted.register).not.toHaveBeenCalled();
    expect(await screen.findByText(/Mật khẩu xác nhận không khớp/)).toBeInTheDocument();
  });

  it('matching_passwords_calls_register_with_expected_body', async () => {
    hoisted.register.mockResolvedValue({ success: true, message: 'OTP sent' });
    const user = userEvent.setup();
    render(<AuthPage />);
    await goRegister(user);
    await user.type(document.getElementById('reg-name'), 'Nguyen A');
    await user.type(document.getElementById('reg-email'), 'e@test.com');
    await user.type(document.getElementById('reg-phone'), '0901234567');
    await user.type(document.getElementById('reg-password'), 'samepass12');
    await user.type(document.getElementById('reg-confirm'), 'samepass12');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    await waitFor(() => {
      expect(hoisted.register).toHaveBeenCalledWith({
        email: 'e@test.com',
        password: 'samepass12',
        confirm_password: 'samepass12',
        full_name: 'Nguyen A',
        phone_number: '0901234567',
      });
    });
  });

  it('success_moves_to_verify_otp_and_sets_cooldown_60', async () => {
    hoisted.register.mockResolvedValue({ success: true, message: 'Check mail' });
    const user = userEvent.setup();
    render(<AuthPage />);
    await goRegister(user);
    await user.type(document.getElementById('reg-name'), 'A');
    await user.type(document.getElementById('reg-email'), 'e@test.com');
    await user.type(document.getElementById('reg-phone'), '0901234567');
    await user.type(document.getElementById('reg-password'), 'password12');
    await user.type(document.getElementById('reg-confirm'), 'password12');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    expect(await screen.findByRole('heading', { name: /Xác thực OTP/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gửi lại sau 60s/i })).toBeDisabled();
  });

  it('register_failure_shows_error', async () => {
    hoisted.register.mockResolvedValue({ success: false, error: 'Email đã tồn tại' });
    const user = userEvent.setup();
    render(<AuthPage />);
    await goRegister(user);
    await user.type(document.getElementById('reg-name'), 'A');
    await user.type(document.getElementById('reg-email'), 'dup@test.com');
    await user.type(document.getElementById('reg-phone'), '0901234567');
    await user.type(document.getElementById('reg-password'), 'password12');
    await user.type(document.getElementById('reg-confirm'), 'password12');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    expect(await screen.findByText(/Email đã tồn tại/)).toBeInTheDocument();
  });

  it('register_reject_shows_connection_error', async () => {
    hoisted.register.mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    render(<AuthPage />);
    await goRegister(user);
    await user.type(document.getElementById('reg-name'), 'A');
    await user.type(document.getElementById('reg-email'), 'e@test.com');
    await user.type(document.getElementById('reg-phone'), '0901234567');
    await user.type(document.getElementById('reg-password'), 'password12');
    await user.type(document.getElementById('reg-confirm'), 'password12');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    expect(await screen.findByText(/Không thể kết nối đến server/)).toBeInTheDocument();
  });
});
