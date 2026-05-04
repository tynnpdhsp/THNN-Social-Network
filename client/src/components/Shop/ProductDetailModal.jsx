import React, { useState } from 'react';
import { X, Star, ShoppingCart, MessageSquare, Send, User } from 'lucide-react';

const ProductDetailModal = ({ isOpen, onClose, product }) => {
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  
  const mockComments = [
    { id: 1, user: 'Nguyễn Văn A', rating: 5, content: 'Sản phẩm rất tốt, giao hàng nhanh!', date: '2 ngày trước' },
    { id: 2, user: 'Trần Thị B', rating: 4, content: 'Chất lượng ổn, đúng như mô tả.', date: '5 ngày trước' },
  ];

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000,
      backdropFilter: 'blur(8px)'
    }} onClick={onClose}>
      <div style={{
        background: 'white',
        width: '900px',
        maxWidth: '95vw',
        height: '80vh',
        borderRadius: 'var(--rounded-lg)',
        display: 'flex',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)'
      }} onClick={e => e.stopPropagation()}>
        
        <button onClick={onClose} style={{ 
          position: 'absolute', top: 20, right: 20, zIndex: 10,
          background: 'white', border: 'none', cursor: 'pointer', 
          width: 40, height: 40, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <X size={24} />
        </button>

        {/* Left: Image Area */}
        <div style={{ flex: 1, background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img 
            src={product.image} 
            alt={product.title} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        </div>

        {/* Right: Info Area */}
        <div style={{ width: '450px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
               <div>
                 <span className="caption-sm" style={{ textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 700 }}>{product.category === 'docs' ? 'Tài liệu' : product.category === 'books' ? 'Giáo trình' : 'Vật dụng'}</span>
                 <h2 className="heading-xl" style={{ marginTop: 4 }}>{product.title}</h2>
               </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <div style={{ display: 'flex', color: '#ffc107' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={18} fill={i <= Math.round(product.rating) ? "#ffc107" : "none"} stroke={i <= Math.round(product.rating) ? "#ffc107" : "#ccc"} />
                ))}
              </div>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{product.rating}</span>
              <span style={{ color: 'var(--mute)' }}>({product.reviews} nhận xét)</span>
            </div>

            <p className="heading-xl" style={{ color: 'var(--primary)', marginBottom: 24 }}>
              {product.price?.toLocaleString()}đ
            </p>

            <div style={{ marginBottom: 32 }}>
              <h3 className="body-strong" style={{ marginBottom: 8 }}>Mô tả sản phẩm</h3>
              <p className="body-md" style={{ color: 'var(--body)', opacity: 0.8 }}>{product.description}</p>
            </div>

            <button className="btn-primary" style={{ width: '100%', height: 56, fontSize: 18, marginBottom: 32 }}>
              <ShoppingCart size={20} /> Thêm vào giỏ hàng
            </button>

            <hr style={{ border: 'none', borderTop: '1px solid var(--hairline)', marginBottom: 32 }} />

            {/* Comments Section */}
            <div style={{ marginBottom: 24 }}>
              <h3 className="heading-md" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <MessageSquare size={20} /> Nhận xét từ người mua
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {mockComments.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-card)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={20} color="var(--mute)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{c.user}</span>
                        <span className="caption-sm">{c.date}</span>
                      </div>
                      <div style={{ display: 'flex', color: '#ffc107', marginBottom: 4 }}>
                        {[1, 2, 3, 4, 5].map(i => <Star key={i} size={12} fill={i <= c.rating ? "#ffc107" : "none"} stroke={i <= c.rating ? "#ffc107" : "#ccc"} />)}
                      </div>
                      <p style={{ fontSize: 14 }}>{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Add Comment Area */}
          <div style={{ padding: '24px 32px', background: 'var(--surface-soft)', borderTop: '1px solid var(--hairline)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Đánh giá của bạn:</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Star 
                    key={i} 
                    size={20} 
                    cursor="pointer"
                    fill={i <= rating ? "#ffc107" : "none"} 
                    stroke={i <= rating ? "#ffc107" : "#ccc"}
                    onClick={() => setRating(i)}
                  />
                ))}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Để lại nhận xét của bạn..." 
                className="input-field"
                style={{ paddingRight: 50, border: '1px solid var(--hairline)', background: 'white' }}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button style={{ 
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%',
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer'
              }}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
