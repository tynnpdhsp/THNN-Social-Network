import React, { useState } from 'react';
import { X, Star, FileText, MessageSquare, Send, User, Download, ExternalLink } from 'lucide-react';

const DocDetailModal = ({ isOpen, onClose, doc }) => {
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  
  const mockComments = [
    { id: 1, user: 'Hoàng Minh', rating: 5, content: 'Tài liệu cực kỳ hữu ích cho kỳ thi sắp tới, cảm ơn tác giả!', date: '1 ngày trước' },
    { id: 2, user: 'Thu Trang', rating: 3, content: 'Tài liệu hơi sơ sài ở chương 2, nhưng tổng thể vẫn tốt.', date: '3 ngày trước' },
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
        width: '800px',
        maxWidth: '95vw',
        height: 'auto',
        maxHeight: '90vh',
        borderRadius: 'var(--rounded-lg)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, background: 'var(--surface-card)', borderRadius: 'var(--rounded-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={24} color="var(--primary)" />
            </div>
            <div>
              <h2 className="heading-lg">{doc.name}</h2>
              <p className="caption-sm">{doc.author} • {doc.date}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '32px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ padding: '4px 12px', background: 'var(--primary)', color: 'white', borderRadius: 'var(--rounded-full)', fontSize: 12, fontWeight: 700 }}>{doc.category}</span>
                <div style={{ display: 'flex', color: '#ffc107' }}>
                   {[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} fill={i <= Math.round(doc.rating) ? "#ffc107" : "none"} stroke={i <= Math.round(doc.rating) ? "#ffc107" : "#ccc"} />)}
                </div>
                <span style={{ fontWeight: 700 }}>{doc.rating}</span>
              </div>
              
              <h3 className="body-strong" style={{ marginBottom: 8 }}>Mô tả tài liệu</h3>
              <p className="body-md" style={{ color: 'var(--body)', opacity: 0.8, marginBottom: 24 }}>{doc.description}</p>

              <div style={{ background: 'var(--surface-card)', padding: '20px', borderRadius: 'var(--rounded-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FileText size={20} color="var(--mute)" />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>Tệp đính kèm: {doc.name}.{doc.type.toLowerCase()}</p>
                    <p className="caption-sm">{doc.size}</p>
                  </div>
                </div>
                <button className="btn-primary" style={{ padding: '8px 16px' }}>
                  <Download size={18} /> Tải xuống
                </button>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--hairline)', marginBottom: 32 }} />

          {/* Comments Section */}
          <div style={{ marginBottom: 24 }}>
            <h3 className="heading-md" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <MessageSquare size={20} /> Bình luận & Đánh giá
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {mockComments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-soft)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              placeholder="Để lại bình luận của bạn..." 
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
  );
};

export default DocDetailModal;
