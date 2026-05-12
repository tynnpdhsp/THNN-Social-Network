import React, { useRef } from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, width = 450 }) => {
  const overlayRef = useRef(null);

  if (!isOpen) return null;
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, width = 450 }) => {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      // Small delay to trigger CSS animation
      requestAnimationFrame(() => setVisible(true));
    }
  }, [isOpen]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      onClose();
    }, 220);
  };

  if (!isOpen && !closing) return null;

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
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000,
        backdropFilter: 'blur(8px)',
        overflowY: 'auto',
        padding: '40px 20px'
      }} 
      onMouseDown={handleOverlayClick}
    >
      <div style={{
        background: 'white',
        width: `${width}px`,
        maxWidth: '100%',
        borderRadius: 'var(--rounded-lg)',
        padding: '32px',
        position: 'relative',
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        marginBottom: '40px'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: closing ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000,
        backdropFilter: closing ? 'blur(0px)' : 'blur(8px)',
        transition: 'background-color 0.25s ease, backdrop-filter 0.25s ease',
        animation: closing ? 'none' : 'fadeIn 0.2s ease',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'white',
          width: `${width}px`,
          maxWidth: '95vw',
          maxHeight: '90vh',
          borderRadius: 'var(--rounded-lg)',
          padding: '32px',
          position: 'relative',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
          overflowY: 'auto',
          animation: closing
            ? 'none'
            : 'scaleIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          transform: closing ? 'scale(0.95)' : 'scale(1)',
          opacity: closing ? 0 : 1,
          transition: closing ? 'transform 0.2s ease, opacity 0.2s ease' : 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 24,
        }}>
          {title && <h2 className="heading-lg">{title}</h2>}
          <button
            onClick={handleClose}
            style={{
              position: title ? 'static' : 'absolute',
              top: title ? 'auto' : 20,
              right: title ? 'auto' : 20,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: '50%',
              transition: 'background 0.2s, transform 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
          >
            <X size={24} color="var(--mute)" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
};

export default Modal;
