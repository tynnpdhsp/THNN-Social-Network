import React, { useRef } from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, itemName, itemType = 'vật phẩm' }) => {
  const overlayRef = useRef(null);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div 
      ref={overlayRef}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 2000, animation: 'fadeIn 0.2s ease-out'
      }}
      onMouseDown={handleOverlayClick}
    >
      <div style={{
        backgroundColor: 'white', borderRadius: 'var(--rounded-lg)',
        width: '100%', maxWidth: 400, padding: 32, position: 'relative',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        animation: 'slideUp 0.3s ease-out'
      }} onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16, border: 'none',
            background: 'transparent', cursor: 'pointer', color: 'var(--mute)'
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ 
            width: 64, height: 64, borderRadius: '50%', background: '#fff5f5',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            margin: '0 auto 16px', color: '#ff4d4f'
          }}>
            <AlertTriangle size={32} />
          </div>
          <h2 className="heading-lg" style={{ marginBottom: 8 }}>Xác nhận xoá</h2>
          <p className="body-md" style={{ color: 'var(--mute)' }}>
            Bạn có chắc chắn muốn xoá {itemType} <strong style={{ color: 'var(--body)' }}>"{itemName}"</strong>? Hành động này không thể hoàn tác.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={onClose}
            className="btn-secondary"
            style={{ flex: 1, height: 48 }}
          >
            Hủy
          </button>
          <button 
            onClick={onConfirm}
            className="btn-primary"
            style={{ flex: 1, height: 48, background: '#ff4d4f', borderColor: '#ff4d4f' }}
          >
            Xác nhận xoá
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default DeleteConfirmModal;
