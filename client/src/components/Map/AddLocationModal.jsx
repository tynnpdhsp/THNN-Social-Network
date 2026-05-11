import React, { useState, useRef } from 'react';
import { Camera, MapPin, X } from 'lucide-react';
import Modal from '../Common/Modal';

const AddLocationModal = ({ isOpen, onClose, onAdd, categories }) => {
  const [newLoc, setNewLoc] = useState({ 
    name: '', 
    category_id: '', 
    description: '', 
    address: '',
    latitude: 21.0285, // Default to Hanoi to match seed
    longitude: 105.8542
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const fileInputRef = useRef(null);

  // Set default category when categories are loaded
  React.useEffect(() => {
    if (categories && categories.length > 0 && !newLoc.category_id) {
      setNewLoc(prev => ({ ...prev, category_id: categories[0].id }));
    }
  }, [categories]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
    
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (newLoc.name && newLoc.category_id) {
      // For now, we randomize coordinates slightly if they are at default
      // In a real app, this would come from a map picker
      const submission = {
        ...newLoc,
        latitude: newLoc.latitude + (Math.random() - 0.5) * 0.002,
        longitude: newLoc.longitude + (Math.random() - 0.5) * 0.002,
        files: selectedFiles // Pass files along
      };
      onAdd(submission);
      onClose();
      resetForm();
    }
  };

  const resetForm = () => {
    setNewLoc({ 
      name: '', 
      category_id: categories[0]?.id || '', 
      description: '', 
      address: '',
      latitude: 21.0285,
      longitude: 105.8542
    });
    setSelectedFiles([]);
    setPreviews([]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm địa điểm mới" width={450}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Tên địa điểm</label>
          <input type="text" className="input-field" placeholder="Ví dụ: Thư viện B..." value={newLoc.name} onChange={e => setNewLoc({...newLoc, name: e.target.value})} />
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Loại địa điểm</label>
            <select className="input-field" value={newLoc.category_id} onChange={e => setNewLoc({...newLoc, category_id: e.target.value})}>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Địa chỉ</label>
            <input type="text" className="input-field" placeholder="Số nhà, tên đường..." value={newLoc.address} onChange={e => setNewLoc({...newLoc, address: e.target.value})} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Mô tả</label>
          <textarea className="input-field" placeholder="Chia sẻ cảm nhận về địa điểm này..." style={{ height: 80, resize: 'none', padding: '12px 20px' }} value={newLoc.description} onChange={e => setNewLoc({...newLoc, description: e.target.value})} />
        </div>

        <div style={{ display: 'flex', gap: 12, padding: 12, background: 'var(--surface-soft)', borderRadius: 'var(--rounded-md)', alignItems: 'center' }}>
          <MapPin size={20} color="var(--primary)" />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700 }}>Tọa độ hiện tại</p>
            <p style={{ fontSize: 11, opacity: 0.7 }}>{newLoc.latitude.toFixed(6)}, {newLoc.longitude.toFixed(6)}</p>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Hình ảnh địa điểm</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
            {previews.map((preview, idx) => (
              <div key={idx} style={{ position: 'relative', width: '100%', paddingTop: '100%', borderRadius: 'var(--rounded-sm)', overflow: 'hidden' }}>
                <img src={preview} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <button 
                  onClick={() => removeFile(idx)}
                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', padding: 2, color: 'white', cursor: 'pointer' }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', paddingTop: '100%', border: '2px dashed var(--hairline)', borderRadius: 'var(--rounded-sm)', position: 'relative', cursor: 'pointer', background: 'var(--surface-soft)' }}
            >
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={20} color="var(--mute)" />
              </div>
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            multiple 
            accept="image/*" 
            onChange={handleFileChange} 
          />
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
