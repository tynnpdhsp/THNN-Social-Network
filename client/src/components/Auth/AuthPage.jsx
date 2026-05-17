import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LogIn, UserPlus, Mail, Lock, User, Phone, Eye, EyeOff,
  ArrowRight, BookOpen, ShieldCheck, KeyRound, RotateCcw, ArrowLeft,
  AlertCircle, CheckCircle2,
} from 'lucide-react';
import logoImg from '../../assets/logo.png';

// ─── Mode constants ───────────────────────────────────────────────────────────
const MODE = {
  LOGIN: 'login',
  REGISTER: 'register',
  VERIFY_OTP: 'verify_otp',
  FORGOT_PASSWORD: 'forgot_password',
  RESET_PASSWORD: 'reset_password',
};

// ─── Shared Input Component (outside AuthPage for stable identity) ─────────
const InputField = ({ id, icon: Icon, label, type = 'text', placeholder, value, onChange, required = true, minLength, children }) => (
  <div style={styles.inputGroup}>
    <label style={styles.label}>{label}</label>
    <div style={styles.inputWrapper}>
      <Icon size={18} color="var(--ash)" style={styles.inputIcon} />
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        className="input-field"
        style={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
      />
      {children}
    </div>
  </div>
);

const PasswordToggle = ({ showPassword, setShowPassword }) => (
  <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
  </button>
);

const SubmitBtn = ({ text, loading }) => (
  <button type="submit" className="btn-primary" style={styles.submitBtn} disabled={loading}>
    {loading ? 'Đang xử lý...' : text}
    {!loading && <ArrowRight size={18} />}
  </button>
);

const OtpInputGrid = ({ otpDigits, handleOtpChange, handleOtpKeyDown, handleOtpPaste, otpRefs }) => (
  <div style={styles.otpRow}>
    {otpDigits.map((d, i) => (
      <input
        key={i}
        ref={(el) => (otpRefs.current[i] = el)}
        type="text"
        inputMode="numeric"
        maxLength={1}
        value={d}
        onChange={(e) => handleOtpChange(i, e.target.value)}
        onKeyDown={(e) => handleOtpKeyDown(i, e)}
        onPaste={i === 0 ? handleOtpPaste : undefined}
        style={{
          ...styles.otpInput,
          borderColor: d ? 'var(--primary)' : 'var(--border)',
          boxShadow: d ? '0 0 0 2px rgba(230,0,35,0.1)' : 'none',
        }}
        className="input-field"
      />
    ))}
  </div>
);

const AuthPage = () => {
  const {
    login, register, verifyOtp, resendVerificationOtp,
    forgotPassword, resetPassword,
  } = useAuth();

  const [mode, setMode] = useState(MODE.LOGIN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // OTP
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpPurpose, setOtpPurpose] = useState('register');
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef([]);

  // Reset password
  const [newPassword, setNewPassword] = useState('');

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const clearMessages = () => { setError(''); setSuccess(''); };

  const switchMode = (m) => {
    setMode(m);
    clearMessages();
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleLogin = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) setError(result.error);
    } catch {
      setError('Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    clearMessages();
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    const onlyDigits = /^\d+$/.test(password);
    const onlyLetters = /^[a-zA-Z]+$/.test(password);
    if (onlyDigits || onlyLetters) {
      setError('Mật khẩu quá yếu! Mật khẩu phải chứa cả chữ và số.');
      return;
    }
    setLoading(true);
    try {
      const result = await register({
        email, password, confirm_password: confirmPassword,
        full_name: fullName, phone_number: phone,
      });
      if (result.success) {
        setSuccess(result.message || 'Đăng ký thành công! Kiểm tra email để nhập mã OTP.');
        setOtpPurpose('register');
        setOtpDigits(['', '', '', '', '', '']);
        setResendCooldown(60);
        setMode(MODE.VERIFY_OTP);
      } else {
        setError(result.error);
      }
    } catch {
      setError('Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    clearMessages();
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số OTP');
      return;
    }
    setLoading(true);
    try {
      const result = await verifyOtp(email, code, otpPurpose);
      if (result.success) {
        if (otpPurpose === 'register') {
          setSuccess('Xác thực thành công! Bạn có thể đăng nhập ngay.');
          setMode(MODE.LOGIN);
        } else {
          // reset_password purpose — move to new password screen
          setSuccess('Xác thực OTP thành công. Nhập mật khẩu mới.');
          setMode(MODE.RESET_PASSWORD);
        }
      } else {
        setError(result.error);
      }
    } catch {
      setError('Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    clearMessages();
    setLoading(true);
    try {
      let result;
      if (otpPurpose === 'register') {
        result = await resendVerificationOtp(email);
      } else {
        result = await forgotPassword(email);
      }
      if (result.success) {
        setSuccess(result.message || 'Đã gửi lại mã OTP vào email.');
        setResendCooldown(60);
        setOtpDigits(['', '', '', '', '', '']);
      } else {
        setError(result.error);
      }
    } catch {
      setError('Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!email) { setError('Vui lòng nhập email'); return; }
    setLoading(true);
    try {
      const result = await forgotPassword(email);
      if (result.success) {
        setSuccess(result.message || 'Đã gửi mã OTP vào email.');
        setOtpPurpose('reset_password');
        setOtpDigits(['', '', '', '', '', '']);
        setResendCooldown(60);
        setMode(MODE.VERIFY_OTP);
      } else {
        setError(result.error);
      }
    } catch {
      setError('Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    clearMessages();
    if (newPassword.length < 8) {
      setError('Mật khẩu phải có tối thiểu 8 ký tự');
      return;
    }
    const onlyDigits = /^\d+$/.test(newPassword);
    const onlyLetters = /^[a-zA-Z]+$/.test(newPassword);
    if (onlyDigits || onlyLetters) {
      setError('Mật khẩu quá yếu! Mật khẩu phải chứa cả chữ và số.');
      return;
    }
    setLoading(true);
    try {
      const code = otpDigits.join('');
      const result = await resetPassword(email, code, newPassword);
      if (result.success) {
        setSuccess(result.message || 'Đặt lại mật khẩu thành công!');
        setNewPassword('');
        setMode(MODE.LOGIN);
      } else {
        setError(result.error);
      }
    } catch {
      setError('Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  // ─── OTP Input Helpers ────────────────────────────────────────────────────

  const handleOtpChange = (idx, val) => {
    if (val && !/^\d$/.test(val)) return;
    const next = [...otpDigits];
    next[idx] = val;
    setOtpDigits(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...otpDigits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || '';
    setOtpDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    otpRefs.current[focusIdx]?.focus();
  };



  // --- Moved outside to prevent re-renders ---

  // ─── Determine header text ────────────────────────────────────────────────

  const getHeaderInfo = () => {
    switch (mode) {
      case MODE.VERIFY_OTP:
        return {
          icon: <ShieldCheck size={28} color="white" />,
          title: 'Xác thực OTP',
          sub: `Nhập mã 6 chữ số đã gửi đến ${email}`,
        };
      case MODE.FORGOT_PASSWORD:
        return {
          icon: <KeyRound size={28} color="white" />,
          title: 'Quên mật khẩu',
          sub: 'Nhập email để nhận mã OTP đặt lại mật khẩu',
        };
      case MODE.RESET_PASSWORD:
        return {
          icon: <RotateCcw size={28} color="white" />,
          title: 'Đặt lại mật khẩu',
          sub: 'Nhập mật khẩu mới cho tài khoản của bạn',
        };
      default:
        return {
          icon: <BookOpen size={28} color="white" />,
          title: <>THNN <span style={{ color: 'var(--primary)' }}>Social</span></>,
          sub: 'Mạng xã hội & học tập cho sinh viên',
        };
    }
  };

  const header = getHeaderInfo();
  const showTabs = mode === MODE.LOGIN || mode === MODE.REGISTER;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      <div style={styles.bgDecor1} />
      <div style={styles.bgDecor2} />

      <div style={styles.card}>
        {/* Back Button for sub-screens */}
        {!showTabs && (
          <button
            onClick={() => switchMode(MODE.LOGIN)}
            style={styles.backBtn}
          >
            <ArrowLeft size={16} /> Quay lại đăng nhập
          </button>
        )}

        {/* Logo / Header */}
        <div style={styles.logoSection}>
          {mode === MODE.LOGIN || mode === MODE.REGISTER ? (
            <div style={{ marginBottom: 16 }}>
              <img 
                src={logoImg} 
                alt="Logo" 
                style={{ 
                  height: 68, 
                  width: 'auto', 
                  objectFit: 'contain', 
                  transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), filter 0.3s ease' 
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.08)';
                  e.currentTarget.style.filter = 'drop-shadow(0 8px 24px rgba(230,0,35,0.2))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.filter = 'none';
                }}
              />
            </div>
          ) : (
            <div
              style={styles.logoIcon}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'rotate(-8deg) scale(1.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'rotate(0) scale(1)')}
            >
              {header.icon}
            </div>
          )}
          <h1 style={styles.logoText}>{header.title}</h1>
          <p style={styles.logoSub}>{header.sub}</p>
        </div>

        {/* Tab Switcher — only login/register */}
        {showTabs && (
          <div style={styles.tabRow}>
            <button
              onClick={() => switchMode(MODE.LOGIN)}
              style={{ ...styles.tab, ...(mode === MODE.LOGIN ? styles.tabActive : {}) }}
            >
              <LogIn size={16} /> Đăng nhập
            </button>
            <button
              onClick={() => switchMode(MODE.REGISTER)}
              style={{ ...styles.tab, ...(mode === MODE.REGISTER ? styles.tabActive : {}) }}
            >
              <UserPlus size={16} /> Đăng ký
            </button>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div style={{ ...styles.errorBox, animation: 'shake 0.4s ease' }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}
        {success && (
          <div style={{ ...styles.successBox, animation: 'fadeInUp 0.4s ease' }}>
            <CheckCircle2 size={18} /> {success}
          </div>
        )}

        {/* ═══ LOGIN ═══ */}
        {mode === MODE.LOGIN && (
          <form onSubmit={handleLogin} style={styles.form} key="login">
            <InputField id="login-email" icon={Mail} label="Email" type="email"
              placeholder="Nhập email của bạn" value={email} onChange={setEmail} />
            <InputField id="login-password" icon={Lock} label="Mật khẩu"
              type={showPassword ? 'text' : 'password'} placeholder="••••••••"
              value={password} onChange={setPassword}>
              <PasswordToggle showPassword={showPassword} setShowPassword={setShowPassword} />
            </InputField>
            <button
              type="button"
              onClick={() => switchMode(MODE.FORGOT_PASSWORD)}
              style={styles.forgotLink}
            >
              Quên mật khẩu?
            </button>
            <SubmitBtn text="Đăng nhập" loading={loading} />
          </form>
        )}

        {/* ═══ REGISTER ═══ */}
        {mode === MODE.REGISTER && (
          <form onSubmit={handleRegister} style={styles.form} key="register">
            <InputField id="reg-name" icon={User} label="Họ và tên"
              placeholder="Nguyễn Văn A" value={fullName} onChange={setFullName} />
            <InputField id="reg-email" icon={Mail} label="Email" type="email"
              placeholder="Nhập email của bạn" value={email} onChange={setEmail} />
            <InputField id="reg-phone" icon={Phone} label="Số điện thoại" type="tel"
              placeholder="0901234567" value={phone} onChange={setPhone} minLength={10} />
            <InputField id="reg-password" icon={Lock} label="Mật khẩu"
              type={showPassword ? 'text' : 'password'} placeholder="Tối thiểu 8 ký tự"
              value={password} onChange={setPassword} minLength={8}>
              <PasswordToggle showPassword={showPassword} setShowPassword={setShowPassword} />
            </InputField>
            {password && (/^\d+$/.test(password) || /^[a-zA-Z]+$/.test(password)) && (
              <p style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--primary)',
                marginTop: -8,
                marginBottom: 12
              }}>
                Mật khẩu yếu! Nên kết hợp cả chữ và số.
              </p>
            )}
            <InputField id="reg-confirm" icon={Lock} label="Xác nhận mật khẩu"
              type={showPassword ? 'text' : 'password'} placeholder="Nhập lại mật khẩu"
              value={confirmPassword} onChange={setConfirmPassword} minLength={8} />
            <SubmitBtn text="Tạo tài khoản" loading={loading} />
          </form>
        )}

        {/* ═══ VERIFY OTP ═══ */}
        {mode === MODE.VERIFY_OTP && (
          <form onSubmit={handleVerifyOtp} style={styles.form} key="otp">
            <OtpInputGrid 
              otpDigits={otpDigits} 
              handleOtpChange={handleOtpChange} 
              handleOtpKeyDown={handleOtpKeyDown} 
              handleOtpPaste={handleOtpPaste} 
              otpRefs={otpRefs} 
            />
            <SubmitBtn text="Xác thực" loading={loading} />
            <div style={styles.resendRow}>
              <span style={{ color: 'var(--mute)', fontSize: 13 }}>Không nhận được mã?</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                style={{
                  ...styles.resendBtn,
                  opacity: resendCooldown > 0 ? 0.5 : 1,
                }}
              >
                {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : 'Gửi lại mã'}
              </button>
            </div>
          </form>
        )}

        {/* ═══ FORGOT PASSWORD ═══ */}
        {mode === MODE.FORGOT_PASSWORD && (
          <form onSubmit={handleForgotPassword} style={styles.form} key="forgot">
            <InputField id="forgot-email" icon={Mail} label="Email" type="email"
              placeholder="Nhập email của bạn" value={email} onChange={setEmail} />
            <SubmitBtn text="Gửi mã OTP" loading={loading} />
          </form>
        )}

        {/* ═══ RESET PASSWORD ═══ */}
        {mode === MODE.RESET_PASSWORD && (
          <form onSubmit={handleResetPassword} style={styles.form} key="reset">
            <InputField id="reset-password" icon={Lock} label="Mật khẩu mới"
              type={showPassword ? 'text' : 'password'} placeholder="Tối thiểu 8 ký tự"
              value={newPassword} onChange={setNewPassword} minLength={8}>
              <PasswordToggle showPassword={showPassword} setShowPassword={setShowPassword} />
            </InputField>
            {newPassword && (/^\d+$/.test(newPassword) || /^[a-zA-Z]+$/.test(newPassword)) && (
              <p style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--primary)',
                marginTop: -8,
                marginBottom: 12
              }}>
                Mật khẩu yếu! Nên kết hợp cả chữ và số.
              </p>
            )}
            <SubmitBtn text="Đặt lại mật khẩu" loading={loading} />
          </form>
        )}

        <p style={styles.footer}>© 2026 THNN Social — Nền tảng dành cho sinh viên</p>
      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #fafafa 0%, #f0f0ed 100%)',
    position: 'relative',
    overflow: 'hidden',
    padding: 24,
  },
  bgDecor1: {
    position: 'absolute', width: 500, height: 500, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(230,0,35,0.06) 0%, transparent 70%)',
    top: -100, right: -100,
  },
  bgDecor2: {
    position: 'absolute', width: 400, height: 400, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(67,94,229,0.06) 0%, transparent 70%)',
    bottom: -100, left: -100,
  },
  card: {
    background: 'white',
    borderRadius: 'var(--rounded-lg)',
    padding: '48px 40px',
    width: 440,
    maxWidth: '100%',
    boxShadow: '0 24px 80px rgba(0,0,0,0.08)',
    position: 'relative',
    zIndex: 1,
    animation: 'scaleIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: 'none',
    color: 'var(--mute)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 16,
    padding: 0,
    transition: 'color 0.2s',
  },
  logoSection: { textAlign: 'center', marginBottom: 32 },
  logoIcon: {
    width: 56, height: 56, borderRadius: 16,
    background: 'var(--primary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    boxShadow: '0 8px 24px rgba(230,0,35,0.2)',
    transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  logoText: { fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--ink)', margin: 0 },
  logoSub: { fontSize: 14, color: 'var(--mute)', marginTop: 4, fontWeight: 500 },
  tabRow: {
    display: 'flex', gap: 4, background: 'var(--surface-card)',
    borderRadius: 'var(--rounded-full)', padding: 4, marginBottom: 24,
  },
  tab: {
    flex: 1, padding: '10px 16px', border: 'none',
    borderRadius: 'var(--rounded-full)', background: 'transparent',
    fontWeight: 600, fontSize: 14, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    color: 'var(--mute)', transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  tabActive: {
    background: 'white', color: 'var(--ink)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  errorBox: {
    background: '#fef2f2', color: '#dc2626',
    padding: '12px 16px', borderRadius: 'var(--rounded-md)',
    fontSize: 13, fontWeight: 600, marginBottom: 16,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  successBox: {
    background: '#f0fdf4', color: '#16a34a',
    padding: '12px 16px', borderRadius: 'var(--rounded-md)',
    fontSize: 13, fontWeight: 600, marginBottom: 16,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: 20,
    animation: 'fadeInUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', paddingLeft: 4 },
  inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: 16, pointerEvents: 'none' },
  input: { paddingLeft: 44, paddingRight: 44, height: 48 },
  eyeBtn: {
    position: 'absolute', right: 12, background: 'none',
    border: 'none', cursor: 'pointer', color: 'var(--ash)', padding: 4,
  },
  submitBtn: { width: '100%', height: 48, marginTop: 8, fontSize: 16 },
  forgotLink: {
    background: 'none', border: 'none', color: 'var(--primary)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    textAlign: 'right', padding: 0, marginTop: -12,
  },
  footer: { textAlign: 'center', fontSize: 12, color: 'var(--ash)', marginTop: 32, fontWeight: 500 },
  // OTP
  otpRow: {
    display: 'flex', justifyContent: 'center', gap: 10, marginTop: 8,
  },
  otpInput: {
    width: 48, height: 56, textAlign: 'center',
    fontSize: 22, fontWeight: 700, letterSpacing: 0,
    borderRadius: 'var(--rounded-md)',
    border: '2px solid var(--border)',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    padding: 0,
    caretColor: 'var(--primary)',
  },
  resendRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 4,
  },
  resendBtn: {
    background: 'none', border: 'none',
    color: 'var(--primary)', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', padding: 0,
  },
};

export default AuthPage;
