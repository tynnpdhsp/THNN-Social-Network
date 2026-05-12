import React, { useState } from 'react';
import { Camera, X } from 'lucide-react';
import { apiFetch, resolveImageUrl } from '../../config/api';
import Modal from '../Common/Modal';

const AddLocationModal = ({ isOpen, onClose, onAdd, locationTypes }) => {
  const [newLoc, setNewLoc] = useState({ name: '', type: 'Học tập', description: '', image_url: '' });
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await apiFetch('/social/media/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setNewLoc(prev => ({ ...prev, image_url: data.image_url }));
      } else {
        alert('Tải ảnh thất bại');
      }
    } catch (err) {
      alert('Lỗi kết nối server');
    }
    setUploading(false);
  };

  const handleSubmit = () => {
    if (newLoc.name) {
      onAdd(newLoc);
      onClose();
      setNewLoc({ name: '', type: 'Học tập', description: '', image_url: '' });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm địa điểm mới" width={450}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Tên địa điểm</label>
          <input type="text" className="input-field" placeholder="Ví dụ: Thư viện B..." value={newLoc.name} onChange={e => setNewLoc({...newLoc, name: e.target.value})} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Loại địa điểm</label>
          <select className="input-field" value={newLoc.type} onChange={e => setNewLoc({...newLoc, type: e.target.value})}>
            {locationTypes.filter(t => t !== 'Tất cả').map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Mô tả</label>
          <textarea className="input-field" placeholder="Chia sẻ cảm nhận về địa điểm này..." style={{ height: 80, resize: 'none', padding: '12px 20px' }} value={newLoc.description} onChange={e => setNewLoc({...newLoc, description: e.target.value})} />
        </div>
        <div 
          onClick={() => !newLoc.image_url && document.getElementById('location-image-upload').click()}
          style={{ 
            border: '2px dashed var(--hairline)', 
            padding: newLoc.image_url ? '10px' : '24px', 
            borderRadius: 'var(--rounded-md)', 
            textAlign: 'center', 
            cursor: newLoc.image_url ? 'default' : 'pointer', 
            background: 'var(--surface-soft)',
            position: 'relative',
            minHeight: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {newLoc.image_url ? (
            <div style={{ position: 'relative', width: '100%' }}>
              <img src={resolveImageUrl(newLoc.image_url)} alt="preview" style={{ width: '100%', maxHeight: 150, objectFit: 'cover', borderRadius: 8 }} />
              <button 
                type="button"
                onClick={() => setNewLoc(prev => ({ ...prev, image_url: '' }))}
                style={{ position: 'absolute', top: 8, right: 8, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <Camera size={32} style={{ color: 'var(--mute)', marginBottom: 8 }} />
              <p style={{ fontSize: 13, fontWeight: 700 }}>{uploading ? 'Đang tải...' : 'Tải lên hình ảnh địa điểm'}</p>
            </>
          )}
          <input type="file" id="location-image-upload" hidden accept="image/*" onChange={handleUpload} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Hủy</button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={handleSubmit}>Chia sẻ địa điểm</button>
        </div>
      </div>
    </Modal>
  );
};

export default AddLocationModal;
