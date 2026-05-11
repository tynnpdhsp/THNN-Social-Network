import React, { useState, useEffect, useRef } from 'react';
import { X, Star, ShoppingCart, MessageSquare, Send, User } from 'lucide-react';
import toast from 'react-hot-toast';
import * as shopService from '../../services/shopService';

const ProductDetailModal = ({ isOpen, onClose, product, onBuyNow }) => {
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const [reviews, setReviews] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (isOpen && product?.id) {
      fetchReviews();
    }
  }, [isOpen, product?.id]);

  const fetchReviews = async () => {
    try {
      const res = await shopService.getReviews(product.id);
      setReviews(res.items || []);
    } catch (error) {
      console.error("Lỗi khi tải nhận xét:", error);
    }
  };

  const handleReviewSubmit = async () => {
    if (!comment.trim()) return;
    setIsSubmitting(true);
    try {
      await shopService.createReview(product.id, {
        rating: rating,
        comment: comment
      });
      setComment('');
      setRating(5);
      fetchReviews();
      toast.success("Cảm ơn bạn đã đánh giá!");
    } catch (error) {
      if (error.message.includes("MUST_PURCHASE_FIRST") || error.message.includes("purchase")) {
        toast.error("Bạn phải mua và thanh toán sản phẩm này mới có thể đánh giá!");
      } else {
        toast.error("Lỗi đăng nhận xét: " + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        zIndex: 2000,
        backdropFilter: 'blur(8px)',
        overflowY: 'auto',
        padding: '40px 20px'
      }} 
      onMouseDown={handleOverlayClick}
    >
      <div style={{
        background: 'white',
        width: '900px',
        maxWidth: '100%',
        minHeight: '600px',
        height: 'auto',
        maxHeight: 'none',
        borderRadius: 'var(--rounded-lg)',
        display: 'flex',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        marginBottom: '40px'
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
        <div style={{ flex: 1, background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <img 
            src={product.images && product.images.length > 0 ? product.images[0].image_url : 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&q=80&w=600'} 
            alt={product.title} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        </div>

        {/* Right: Info Area */}
        <div style={{ width: '450px', display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '1px solid var(--hairline)' }}>
          <div style={{ padding: '32px', overflowY: 'auto', flex: 1, scrollbarWidth: 'thin' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
               <div>
                 <span className="caption-sm" style={{ textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 700 }}>{product.category?.name || 'Vật dụng'}</span>
                 <h2 className="heading-xl" style={{ marginTop: 4 }}>{product.title}</h2>
               </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <div style={{ display: 'flex', color: '#ffc107' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={18} fill={i <= Math.round(product.avg_rating || 0) ? "#ffc107" : "none"} stroke={i <= Math.round(product.avg_rating || 0) ? "#ffc107" : "#ccc"} />
                ))}
              </div>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{product.avg_rating || 0}</span>
              <span style={{ color: 'var(--mute)' }}>({product.rating_count || 0} nhận xét)</span>
            </div>

            <p className="heading-xl" style={{ color: 'var(--primary)', marginBottom: 24 }}>
              {product.price?.toLocaleString()}đ
            </p>

            <div style={{ marginBottom: 32 }}>
              <h3 className="body-strong" style={{ marginBottom: 8 }}>Mô tả sản phẩm</h3>
              <p className="body-md" style={{ color: 'var(--body)', opacity: 0.8 }}>{product.description}</p>
            </div>

            <button 
              className="btn-primary" 
              style={{ width: '100%', height: 56, fontSize: 18, marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={() => onBuyNow(product)}
            >
              <ShoppingCart size={20} /> Mua ngay
            </button>

            <hr style={{ border: 'none', borderTop: '1px solid var(--hairline)', marginBottom: 32 }} />

            {/* Comments Section */}
            <div style={{ marginBottom: 24 }}>
              <h3 className="heading-md" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <MessageSquare size={20} /> Nhận xét từ người mua
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {reviews.length === 0 ? (
                  <p style={{ color: 'var(--mute)' }}>Chưa có nhận xét nào.</p>
                ) : (
                  reviews.map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-card)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {c.user_info?.avatar_url ? (
                          <img src={c.user_info.avatar_url} alt={c.user_info.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <User size={20} color="var(--mute)" />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{c.user_info?.full_name || 'Khách'}</span>
                          <span className="caption-sm">{new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <div style={{ display: 'flex', color: '#ffc107', marginBottom: 4 }}>
                          {[1, 2, 3, 4, 5].map(i => <Star key={i} size={12} fill={i <= c.rating ? "#ffc107" : "none"} stroke={i <= c.rating ? "#ffc107" : "#ccc"} />)}
                        </div>
                        <p style={{ fontSize: 14 }}>{c.comment}</p>
                      </div>
                    </div>
                  ))
                )}
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
              <button 
                style={{ 
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: isSubmitting || !comment.trim() ? 'var(--ash)' : 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%',
                  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: isSubmitting || !comment.trim() ? 'not-allowed' : 'pointer'
                }}
                onClick={handleReviewSubmit}
                disabled={isSubmitting || !comment.trim()}
              >
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
