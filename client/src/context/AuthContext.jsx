import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { apiFetch } from '../config/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch('/account/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        // Token invalid
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      }
    } catch {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Helper to extract error message from FastAPI responses
  const extractError = (data, fallback) => {
    if (!data.detail) return fallback;
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map((e) => e.msg || JSON.stringify(e)).join('; ');
    }
    if (typeof data.detail === 'object') {
      return data.detail.msg || JSON.stringify(data.detail);
    }
    return fallback;
  };

  const login = async (email, password) => {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);

    const res = await apiFetch('/account/login', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      return { success: true };
    }
    return { success: false, error: extractError(data, 'Đăng nhập thất bại') };
  };

  const register = async (body) => {
    const res = await apiFetch('/account/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) return { success: true, message: data.message };
    return { success: false, error: extractError(data, 'Đăng ký thất bại') };
  };

  const verifyOtp = async (email, code, purpose) => {
    const res = await apiFetch('/account/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code, purpose }),
    });
    const data = await res.json();
    if (res.ok) return { success: true, message: data.message };
    return { success: false, error: extractError(data, 'Xác thực OTP thất bại') };
  };

  const resendVerificationOtp = async (email) => {
    const res = await apiFetch('/account/register/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email, purpose: 'register' }),
    });
    const data = await res.json();
    if (res.ok) return { success: true, message: data.message };
    return { success: false, error: extractError(data, 'Gửi lại OTP thất bại') };
  };

  const forgotPassword = async (email) => {
    const res = await apiFetch('/account/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, purpose: 'reset_password' }),
    });
    const data = await res.json();
    if (res.ok) return { success: true, message: data.message };
    return { success: false, error: extractError(data, 'Gửi OTP thất bại') };
  };

  const resetPassword = async (email, code, newPassword) => {
    const res = await apiFetch('/account/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, new_password: newPassword }),
    });
    const data = await res.json();
    if (res.ok) return { success: true, message: data.message };
    return { success: false, error: extractError(data, 'Đặt lại mật khẩu thất bại') };
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const refreshProfile = () => fetchProfile();

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, register, verifyOtp, resendVerificationOtp,
      forgotPassword, resetPassword, logout, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
