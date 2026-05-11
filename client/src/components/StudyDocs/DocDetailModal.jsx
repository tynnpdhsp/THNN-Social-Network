import React, { useState, useEffect } from 'react';
import { X, Star, FileText, MessageSquare, Send, User, Download, Loader2 } from 'lucide-react';
import * as documentService from '../../services/documentService';
import toast from 'react-hot-toast';

const DocDetailModal = ({ isOpen, onClose, doc, onUpdateDoc }) => {
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && doc?.id) {
      fetchReviews();
    }
  }, [isOpen, doc?.id]);

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const data = await documentService.getDocumentReviews(doc.id);
      setReviews(data.items);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setSubmitting(true);
    try {
      await documentService.createDocumentReview(doc.id, {
        rating,
        comment
      });
      setComment('');
      setRating(5);
      
      // Refresh reviews list
      fetchReviews();
      
      // Fetch updated document details to refresh stars/rating in UI
      const updatedDoc = await documentService.getDocumentById(doc.id);
      if (onUpdateDoc) {
        onUpdateDoc(updatedDoc);
      }
      toast.success('Gửi nhận xét thành công!');
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error('Có lỗi xảy ra: ' + (error.message || 'Lỗi không xác định'));
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

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
              <h2 className="heading-lg">{doc.title}</h2>
              <p className="caption-sm">{doc.user_info?.full_name || 'Ẩn danh'} • {formatDate(doc.created_at)}</p>
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
                <span style={{ padding: '4px 12px', background: 'var(--primary)', color: 'white', borderRadius: 'var(--rounded-full)', fontSize: 12, fontWeight: 700 }}>
                  {doc.category?.name || 'Chưa phân loại'}
                </span>
                <div style={{ display: 'flex', color: '#ffc107' }}>
                   {[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} fill={i <= Math.round(doc.avg_rating) ? "#ffc107" : "none"} stroke={i <= Math.round(doc.avg_rating) ? "#ffc107" : "#ccc"} />)}
                </div>
                <span style={{ fontWeight: 700 }}>{doc.avg_rating?.toFixed(1)}</span>
              </div>
              
              <h3 className="body-strong" style={{ marginBottom: 8 }}>Mô tả tài liệu</h3>
              <p className="body-md" style={{ color: 'var(--body)', opacity: 0.8, marginBottom: 24 }}>{doc.description || 'Không có mô tả cho tài liệu này.'}</p>

              <div style={{ background: 'var(--surface-card)', padding: '20px', borderRadius: 'var(--rounded-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FileText size={20} color="var(--mute)" />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>Tệp đính kèm: {doc.file_name}</p>
                    <p className="caption-sm">{formatFileSize(doc.file_size)}</p>
                  </div>
                </div>
                <a 
                  href={doc.file_url} 
                  download 
                  target="_blank" 
                  rel="noreferrer"
                  className="btn-primary" 
                  style={{ padding: '8px 16px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Download size={18} /> Tải xuống
                </a>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--hairline)', marginBottom: 32 }} />

          {/* Comments Section */}
          <div style={{ marginBottom: 24 }}>
            <h3 className="heading-md" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <MessageSquare size={20} /> Bình luận & Đánh giá ({reviews.length})
            </h3>

            {loadingReviews ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <Loader2 className="animate-spin" size={24} color="var(--primary)" />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {reviews.length > 0 ? (
                  reviews.map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-soft)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {c.user_info.avatar_url ? (
                          <img src={c.user_info.avatar_url} alt={c.user_info.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <User size={20} color="var(--mute)" />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{c.user_info.full_name}</span>
                          <span className="caption-sm">{formatDate(c.created_at)}</span>
                        </div>
                        <div style={{ display: 'flex', color: '#ffc107', marginBottom: 4 }}>
                          {[1, 2, 3, 4, 5].map(i => <Star key={i} size={12} fill={i <= c.rating ? "#ffc107" : "none"} stroke={i <= c.rating ? "#ffc107" : "#ccc"} />)}
                        </div>
                        <p style={{ fontSize: 14 }}>{c.comment}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', color: 'var(--mute)', padding: '20px' }}>Chưa có nhận xét nào.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Add Comment Area */}
        <form onSubmit={handleReviewSubmit} style={{ padding: '24px 32px', background: 'var(--surface-soft)', borderTop: '1px solid var(--hairline)' }}>
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
              disabled={submitting}
            />
            <button 
              type="submit"
              disabled={submitting || !comment.trim()}
              style={{ 
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: submitting ? 'var(--mute)' : 'var(--primary)', 
                color: 'white', border: 'none', borderRadius: '50%',
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocDetailModal;
