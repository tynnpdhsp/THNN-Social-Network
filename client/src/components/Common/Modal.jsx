import React, { useRef } from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, width = 450 }) => {
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
          {title && <h2 className="heading-lg">{title}</h2>}
          <button onClick={onClose} style={{ 
            position: title ? 'static' : 'absolute', 
            top: title ? 'auto' : 20, 
            right: title ? 'auto' : 20,
            background: 'none', border: 'none', cursor: 'pointer'
          }}>
            <X size={24} color="var(--mute)" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
};

export default Modal;
