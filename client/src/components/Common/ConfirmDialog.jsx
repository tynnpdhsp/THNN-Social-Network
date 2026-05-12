import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { AlertTriangle, Trash2, Ban, UserX, X } from 'lucide-react';

// ─── Context to provide confirm() globally ────────────────────────
const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
};

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null);

  const confirm = useCallback(({ title, message, confirmText, cancelText, variant, icon }) => {
    return new Promise((resolve) => {
      setState({ title, message, confirmText, cancelText, variant, icon, resolve });
    });
  }, []);

  const handleConfirm = () => {
    state?.resolve(true);
    setState(null);
  };

  const handleCancel = () => {
    state?.resolve(false);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmDialog
          {...state}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
};

// ─── Dialog Component ──────────────────────────────────────────────
function ConfirmDialog({ title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', variant = 'danger', icon, onConfirm, onCancel }) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => onCancel(), 200);
  };

  const handleConfirmClick = () => {
    setClosing(true);
    setTimeout(() => onConfirm(), 200);
  };

  const iconMap = {
    delete: <Trash2 size={24} />,
    block: <Ban size={24} />,
    unfriend: <UserX size={24} />,
    warning: <AlertTriangle size={24} />,
  };

  const variantColors = {
    danger: {
      iconBg: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
      iconColor: '#dc2626',
      btnBg: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
      btnHover: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)',
    },
    warning: {
      iconBg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
      iconColor: '#d97706',
      btnBg: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      btnHover: 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
    },
  };

  const colors = variantColors[variant] || variantColors.danger;
  const displayIcon = icon && iconMap[icon] ? iconMap[icon] : <AlertTriangle size={24} />;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: closing ? 'confirmOverlayOut 0.2s ease forwards' : 'confirmOverlayIn 0.25s ease',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Dialog */}
      <div
        style={{
          position: 'relative',
          background: 'white',
          borderRadius: 20,
          padding: '32px 28px 24px',
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          animation: closing ? 'confirmDialogOut 0.2s ease forwards' : 'confirmDialogIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          textAlign: 'center',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: 'var(--surface-soft, #f5f5f5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ash, #999)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-card, #eee)'; e.currentTarget.style.color = 'var(--ink, #333)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-soft, #f5f5f5)'; e.currentTarget.style.color = 'var(--ash, #999)'; }}
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: colors.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: colors.iconColor,
            animation: 'confirmIconPulse 0.5s ease 0.15s both',
          }}
        >
          {displayIcon}
        </div>

        {/* Title */}
        <h3 style={{
          fontSize: 18,
          fontWeight: 800,
          color: 'var(--ink, #1a1a1a)',
          marginBottom: 8,
          lineHeight: 1.3,
        }}>
          {title || 'Xác nhận'}
        </h3>

        {/* Message */}
        <p style={{
          fontSize: 14,
          color: 'var(--mute, #666)',
          lineHeight: 1.6,
          marginBottom: 28,
          fontWeight: 500,
        }}>
          {message || 'Bạn có chắc chắn muốn thực hiện hành động này?'}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleClose}
            style={{
              flex: 1,
              padding: '12px 20px',
              borderRadius: 12,
              border: '1px solid var(--hairline, #e5e5e5)',
              background: 'white',
              color: 'var(--body, #555)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-soft, #f5f5f5)'; e.currentTarget.style.borderColor = 'var(--body, #999)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = 'var(--hairline, #e5e5e5)'; }}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirmClick}
            style={{
              flex: 1,
              padding: '12px 20px',
              borderRadius: 12,
              border: 'none',
              background: colors.btnBg,
              color: 'white',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
              boxShadow: `0 4px 12px ${colors.iconColor}33`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.btnHover; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 16px ${colors.iconColor}44`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = colors.btnBg; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 12px ${colors.iconColor}33`; }}
          >
            {confirmText}
          </button>
        </div>
      </div>

      {/* Keyframe styles injected once */}
      <style>{`
        @keyframes confirmOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes confirmOverlayOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes confirmDialogIn {
          from { opacity: 0; transform: scale(0.85) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes confirmDialogOut {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.9) translateY(10px); }
        }
        @keyframes confirmIconPulse {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default ConfirmDialog;
