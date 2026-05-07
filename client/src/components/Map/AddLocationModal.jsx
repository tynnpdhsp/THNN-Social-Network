import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import Modal from '../Common/Modal';

const AddLocationModal = ({ isOpen, onClose, onAdd, locationTypes }) => {
  const [newLoc, setNewLoc] = useState({ name: '', type: 'Học tập', description: '', image: null });

  const handleSubmit = () => {
    if (newLoc.name) {
      onAdd(newLoc);
      onClose();
      setNewLoc({ name: '', type: 'Học tập', description: '', image: null });
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
        <div style={{ border: '2px dashed var(--hairline)', padding: 24, borderRadius: 'var(--rounded-md)', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-soft)' }}>
          <Camera size={32} style={{ color: 'var(--mute)', marginBottom: 8 }} />
          <p style={{ fontSize: 13, fontWeight: 700 }}>Tải lên hình ảnh địa điểm</p>
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
