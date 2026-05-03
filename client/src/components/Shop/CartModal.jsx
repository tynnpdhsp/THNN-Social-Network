import React from 'react';
import { X, Trash2, ShoppingBag, CreditCard } from 'lucide-react';

const CartModal = ({ isOpen, onClose, cartItems, onRemove }) => {
  const total = cartItems.reduce((sum, item) => sum + item.price, 0);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      zIndex: 2000,
      backdropFilter: 'blur(8px)'
    }} onClick={onClose}>
      <div style={{
        background: 'white',
        width: '450px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 32px rgba(0,0,0,0.2)',
        position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ padding: '32px', borderBottom: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="heading-lg" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShoppingBag color="var(--primary)" /> Giỏ hàng của bạn
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={24} color="var(--mute)" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          {cartItems.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 64, color: 'var(--ash)' }}>
              <ShoppingBag size={64} style={{ marginBottom: 16, opacity: 0.2 }} />
              <p>Giỏ hàng đang trống.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {cartItems.map((item, index) => (
                <div key={index} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <img src={item.image} style={{ width: 80, height: 80, borderRadius: 'var(--rounded-md)', objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <h4 className="body-strong">{item.title}</h4>
                    <p style={{ color: 'var(--primary)', fontWeight: 700 }}>{item.price.toLocaleString()}đ</p>
                  </div>
                  <button 
                    onClick={() => onRemove(index)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ash)' }}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '32px', background: 'var(--surface-soft)', borderTop: '1px solid var(--hairline)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <span className="heading-md">Tổng cộng:</span>
            <span className="heading-lg" style={{ color: 'var(--primary)' }}>{total.toLocaleString()}đ</span>
          </div>
          <button 
            className="btn-primary" 
            style={{ width: '100%', height: 56, fontSize: 18, gap: 12 }}
            disabled={cartItems.length === 0}
          >
            <CreditCard size={20} /> Thanh toán ngay
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartModal;
