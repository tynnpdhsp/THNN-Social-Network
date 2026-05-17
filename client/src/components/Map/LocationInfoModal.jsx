import React from 'react';
import { MapPin, Navigation, Star, X, Map, Layers } from 'lucide-react';
import Modal from '../Common/Modal';
import { resolveImageUrl, getDefaultAvatar } from '../../config/api';

const LocationInfoModal = ({ isOpen, onClose, location, reviews }) => {
  if (!location) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} width={500} showClose={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header Image */}
        <div style={{ margin: '-32px -32px 20px -32px', position: 'relative' }}>
          <img 
            src={resolveImageUrl(location.images?.[0]?.image_url) || 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&q=80&w=600'} 
            alt={location.name}
            style={{ width: '100%', height: 200, objectFit: 'cover', borderTopLeftRadius: 'var(--rounded-lg)', borderTopRightRadius: 'var(--rounded-lg)' }} 
          />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.7))', borderTopLeftRadius: 'var(--rounded-lg)', borderTopRightRadius: 'var(--rounded-lg)' }}></div>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
            <X size={20} />
          </button>
          
          <div style={{ position: 'absolute', bottom: 16, left: 24, right: 24 }}>
            <span style={{ background: 'var(--primary)', color: 'white', padding: '4px 10px', borderRadius: 'var(--rounded-full)', fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'inline-block' }}>
              {location.category?.name}
            </span>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{location.name}</h2>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 24, padding: '0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'var(--surface-card)', borderRadius: '50%', color: '#ffc107' }}>
              <Star size={18} fill="#ffc107" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{location.avg_rating?.toFixed(1) || '0.0'}</div>
              <div style={{ fontSize: 12, color: 'var(--mute)' }}>{location.rating_count} nhận xét</div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{ padding: '0 8px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Layers size={16} color="var(--primary)" /> Mô tả</h3>
          <div style={{ background: 'var(--surface-soft)', padding: 16, borderRadius: 'var(--rounded-md)' }}>
            <p style={{ fontSize: 14, color: 'var(--body)', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>
              {location.description || 'Chưa có mô tả chi tiết cho địa điểm này.'}
            </p>
          </div>
        </div>

        {/* Address */}
        <div style={{ padding: '0 8px', marginBottom: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Map size={16} color="var(--primary)" /> Địa chỉ</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-md)' }}>
            <div style={{ width: 40, height: 40, background: 'var(--surface-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin size={20} color="var(--primary)" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{location.address || 'Chưa có địa chỉ cụ thể'}</p>
          </div>
        </div>

        {/* Reviews */}
        <div style={{ padding: '0 8px', marginBottom: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            Nhận xét từ cộng đồng
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
            {reviews && reviews.length > 0 ? (
              reviews.map((rev) => (
                <div key={rev.id} style={{ display: 'flex', gap: 12, paddingBottom: 12, borderBottom: '1px solid var(--hairline)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    <img 
                      src={resolveImageUrl(rev.user_info?.avatar_url) || getDefaultAvatar(rev.user_info?.full_name)} 
                      alt="" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{rev.user_info?.full_name || 'Người dùng'}</span>
                      <div style={{ display: 'flex', color: '#ffc107' }}>
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={10} fill={i < rev.rating ? '#ffc107' : 'none'} color="#ffc107" />
                        ))}
                      </div>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--body)', margin: 0, opacity: 0.85 }}>{rev.comment}</p>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 13, color: 'var(--mute)', textAlign: 'center', margin: '16px 0' }}>Chưa có nhận xét nào cho địa điểm này.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default LocationInfoModal;
