import React from 'react';
import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

const CartDrawer = ({ isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem, onCheckout, isLoading }) => {
  if (!isOpen) return null;

  const subtotal = cartItems.reduce((acc, item) => acc + (item.item?.price || 0) * item.quantity, 0);

  return (
    <div className="cart-drawer-overlay" onClick={onClose}>
      <div className={`cart-drawer-content ${isOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cart-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShoppingBag size={24} className="text-primary" />
            <h2 className="heading-md">Giỏ hàng của bạn</h2>
            <span className="cart-count-badge-lg">{cartItems.length}</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="cart-drawer-body">
          {isLoading ? (
            <div className="flex-center" style={{ height: '100%' }}>
              <Loader className="spin text-primary" size={40} />
            </div>
          ) : cartItems.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-cart-icon">
                <ShoppingBag size={64} opacity={0.2} />
              </div>
              <p className="body-lg text-mute">Giỏ hàng đang trống</p>
              <button className="btn-primary" style={{ marginTop: 24 }} onClick={onClose}>
                Tiếp tục mua sắm
              </button>
            </div>
          ) : (
            <div className="cart-items-list">
              {cartItems.map((item) => (
                <div key={item.item_id} className="cart-item-card">
                  <div className="cart-item-image">
                    <img 
                      src={item.item?.images?.[0]?.image_url || 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&q=80&w=200'} 
                      alt={item.item?.title} 
                    />
                  </div>
                  <div className="cart-item-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 className="body-strong text-limit-1">{item.item?.title}</h4>
                      <button className="remove-btn" onClick={() => onRemoveItem(item.item_id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="body-sm text-primary" style={{ fontWeight: 700, margin: '4px 0' }}>
                      {item.item?.price === 0 ? 'Miễn phí' : `${(item.item?.price || 0).toLocaleString('vi-VN')}đ`}
                    </p>
                    <div className="quantity-controls">
                      <button 
                        onClick={() => onUpdateQuantity(item.item_id, Math.max(1, item.quantity - 1))}
                        disabled={item.quantity <= 1}
                      >
                        <Minus size={14} />
                      </button>
                      <span>{item.quantity}</span>
                      <button 
                        onClick={() => onUpdateQuantity(item.item_id, item.quantity + 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="cart-drawer-footer">
            <div className="cart-summary">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="text-mute">Tạm tính:</span>
                <span className="body-strong">{subtotal === 0 ? '0đ' : `${subtotal.toLocaleString('vi-VN')}đ`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                <span className="body-lg" style={{ fontWeight: 800 }}>Tổng cộng:</span>
                <span className="body-lg text-primary" style={{ fontWeight: 900 }}>{subtotal === 0 ? '0đ' : `${subtotal.toLocaleString('vi-VN')}đ`}</span>
              </div>
            </div>
            <button className="btn-primary checkout-btn" onClick={onCheckout}>
              Thanh toán ngay <ArrowRight size={20} style={{ marginLeft: 8 }} />
            </button>
            <p className="text-mute" style={{ textAlign: 'center', fontSize: 12, marginTop: 16 }}>
              Thanh toán an toàn qua cổng VNPAY
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        .cart-drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
          animation: fadeIn 0.3s ease;
        }

        .cart-drawer-content {
          width: 400px;
          height: 100%;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          box-shadow: -10px 0 30px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .cart-drawer-header {
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--hairline);
        }

        .cart-count-badge-lg {
          background: var(--primary);
          color: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
        }

        .close-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--body);
          padding: 8px;
          border-radius: 50%;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: var(--surface-soft);
        }

        .cart-drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .empty-cart {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .cart-items-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .cart-item-card {
          display: flex;
          gap: 16px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--hairline);
        }

        .cart-item-image {
          width: 80px;
          height: 80px;
          border-radius: var(--rounded-md);
          overflow: hidden;
          flex-shrink: 0;
        }

        .cart-item-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .cart-item-info {
          flex: 1;
        }

        .remove-btn {
          background: transparent;
          border: none;
          color: var(--mute);
          cursor: pointer;
          transition: color 0.2s;
        }

        .remove-btn:hover {
          color: var(--primary);
        }

        .quantity-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--surface-soft);
          padding: 4px 8px;
          border-radius: 20px;
          width: fit-content;
        }

        .quantity-controls button {
          background: white;
          border: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          transition: transform 0.1s;
        }

        .quantity-controls button:hover:not(:disabled) {
          transform: scale(1.1);
        }

        .quantity-controls span {
          font-weight: 700;
          font-size: 14px;
          min-width: 20px;
          text-align: center;
        }

        .cart-drawer-footer {
          padding: 24px;
          background: white;
          border-top: 1px solid var(--hairline);
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
        }

        .checkout-btn {
          width: 100%;
          height: 54px;
          font-size: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--rounded-lg);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .text-limit-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default CartDrawer;
