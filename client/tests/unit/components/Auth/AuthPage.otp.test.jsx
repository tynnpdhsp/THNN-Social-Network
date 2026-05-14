import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
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

async function openOtpRegisterFlow(user) {
  hoisted.register.mockResolvedValue({ success: true, message: 'ok' });
  render(<AuthPage />);
  await user.click(screen.getByRole('button', { name: /Đăng ký/i }));
  await user.type(document.getElementById('reg-name'), 'A');
  await user.type(document.getElementById('reg-email'), 'otp@test.com');
  await user.type(document.getElementById('reg-phone'), '0901234567');
  await user.type(document.getElementById('reg-password'), 'password12');
  await user.type(document.getElementById('reg-confirm'), 'password12');
  await user.click(document.querySelector('form button[type="submit"].btn-primary'));
  await screen.findByRole('heading', { name: /Xác thực OTP/i });
}

async function openOtpRegisterFlowWithFireEvents() {
  hoisted.register.mockResolvedValue({ success: true, message: 'ok' });
  render(<AuthPage />);
  fireEvent.click(screen.getByRole('button', { name: /Đăng ký/i }));
  fireEvent.change(document.getElementById('reg-name'), { target: { value: 'A' } });
  fireEvent.change(document.getElementById('reg-email'), { target: { value: 'otp@test.com' } });
  fireEvent.change(document.getElementById('reg-phone'), { target: { value: '0901234567' } });
  fireEvent.change(document.getElementById('reg-password'), { target: { value: 'password12' } });
  fireEvent.change(document.getElementById('reg-confirm'), { target: { value: 'password12' } });
  fireEvent.click(document.querySelector('form button[type="submit"].btn-primary'));
  await screen.findByRole('heading', { name: /Xác thực OTP/i });
}

describe('AuthPage — OTP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.register.mockReset();
    hoisted.verifyOtp.mockReset();
    hoisted.resendVerificationOtp.mockReset();
    hoisted.forgotPassword.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('otp_rejects_non_digit_input', async () => {
    const user = userEvent.setup();
    await openOtpRegisterFlow(user);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(6);
    await user.type(inputs[0], 'a');
    expect(inputs[0]).toHaveValue('');
  });

  it('otp_digit_advances_focus_to_next_cell', async () => {
    const user = userEvent.setup();
    await openOtpRegisterFlow(user);
    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], '1');
    expect(inputs[0]).toHaveValue('1');
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('otp_backspace_on_empty_moves_focus_previous', async () => {
    const user = userEvent.setup();
    await openOtpRegisterFlow(user);
    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], '1');
    expect(document.activeElement).toBe(inputs[1]);
    await user.keyboard('{Backspace}');
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('paste_six_digits_fills_all_and_focuses_last_filled_index', async () => {
    const user = userEvent.setup();
    await openOtpRegisterFlow(user);
    const inputs = screen.getAllByRole('textbox');
    await user.click(inputs[0]);
    await user.paste('123456');
    await waitFor(() => {
      expect(inputs[0]).toHaveValue('1');
      expect(inputs[5]).toHaveValue('6');
    });
    expect(document.activeElement).toBe(inputs[5]);
  });

  it('paste_strips_non_digits', async () => {
    const user = userEvent.setup();
    await openOtpRegisterFlow(user);
    const inputs = screen.getAllByRole('textbox');
    await user.click(inputs[0]);
    await user.paste('12-34-56');
    await waitFor(() => {
      expect(inputs[5]).toHaveValue('6');
    });
  });

  it('submit_with_fewer_than_6_digits_sets_error', async () => {
    const user = userEvent.setup();
    await openOtpRegisterFlow(user);
    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], '1');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    expect(await screen.findByText(/Vui lòng nhập đủ 6 chữ số OTP/)).toBeInTheDocument();
    expect(hoisted.verifyOtp).not.toHaveBeenCalled();
  });

  it('verify_success_register_purpose_returns_to_login', async () => {
    hoisted.verifyOtp.mockResolvedValue({ success: true, message: 'ok' });
    const user = userEvent.setup();
    await openOtpRegisterFlow(user);
    const inputs = screen.getAllByRole('textbox');
    for (let i = 0; i < 6; i++) await user.type(inputs[i], String(i + 1));
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    await waitFor(() => {
      expect(hoisted.verifyOtp).toHaveBeenCalledWith('otp@test.com', '123456', 'register');
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /THNN/i })).toBeInTheDocument();
    });
  });

  it('verify_success_reset_password_purpose_goes_to_reset_password', async () => {
    hoisted.forgotPassword.mockResolvedValue({ success: true, message: 'sent' });
    hoisted.verifyOtp.mockResolvedValue({ success: true, message: 'ok' });
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.click(screen.getByRole('button', { name: /Quên mật khẩu/i }));
    await user.type(document.getElementById('forgot-email'), 'reset@test.com');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    await screen.findByRole('heading', { name: /Xác thực OTP/i });
    const inputs = screen.getAllByRole('textbox');
    for (let i = 0; i < 6; i++) await user.type(inputs[i], String((i + 3) % 10));
    const code = inputs.map((el) => el.value).join('');
    await user.click(document.querySelector('form button[type="submit"].btn-primary'));
    await waitFor(() => {
      expect(hoisted.verifyOtp).toHaveBeenCalledWith('reset@test.com', code, 'reset_password');
    });
    expect(await screen.findByRole('heading', { name: /Đặt lại mật khẩu/i })).toBeInTheDocument();
  });

  it('resend_disabled_during_cooldown_does_not_call_api', async () => {
    const user = userEvent.setup();
    await openOtpRegisterFlow(user);
    const resend = screen.getByRole('button', { name: /Gửi lại sau/i });
    expect(resend).toBeDisabled();
    await user.click(resend);
    expect(hoisted.resendVerificationOtp).not.toHaveBeenCalled();
  });

  it('resend_after_cooldown_register_calls_resendVerificationOtp', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    hoisted.resendVerificationOtp.mockResolvedValue({ success: true, message: 'resent' });
    await openOtpRegisterFlowWithFireEvents();
    for (let i = 0; i < 65; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    const resend = screen.getByRole('button', { name: /^Gửi lại mã$/i });
    expect(resend).not.toBeDisabled();
    fireEvent.click(resend);
    await waitFor(() => {
      expect(hoisted.resendVerificationOtp).toHaveBeenCalledWith('otp@test.com');
    });
  });

  it('resend_after_cooldown_reset_password_flow_calls_forgotPassword', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    hoisted.forgotPassword.mockResolvedValue({ success: true, message: 'sent' });
    render(<AuthPage />);
    fireEvent.click(screen.getByRole('button', { name: /Quên mật khẩu/i }));
    fireEvent.change(document.getElementById('forgot-email'), { target: { value: 'x@test.com' } });
    fireEvent.click(document.querySelector('form button[type="submit"].btn-primary'));
    await screen.findByRole('heading', { name: /Xác thực OTP/i });
    for (let i = 0; i < 65; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    hoisted.forgotPassword.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /^Gửi lại mã$/i }));
    await waitFor(() => {
      expect(hoisted.forgotPassword).toHaveBeenCalledWith('x@test.com');
    });
  });

  it('cooldown_timer_decrements_every_second', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await openOtpRegisterFlow(user);
    expect(screen.getByRole('button', { name: /Gửi lại sau 60s/i })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Gửi lại sau 59s/i })).toBeInTheDocument();
    });
  });
});
