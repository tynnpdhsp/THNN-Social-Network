import React, { useState, useRef } from 'react';
import { Camera, MapPin, X, ChevronDown } from 'lucide-react';
import Modal from '../Common/Modal';

const AddLocationModal = ({ isOpen, onClose, onAdd, categories, initialCoords }) => {
  const [newLoc, setNewLoc] = useState({ 
    name: '', 
    category_id: '', 
    description: '', 
    address: '',
    latitude: 10.762622, // Default to Saigon
    longitude: 106.660172
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Update coords if initialCoords are provided (e.g. from map click)
  React.useEffect(() => {
    if (initialCoords) {
      setNewLoc(prev => ({ ...prev, latitude: initialCoords.lat, longitude: initialCoords.lng, address: 'Đang tải địa chỉ chi tiết...' }));
      
      // Auto-fill address using Photon (Komoot) for street-level OpenStreetMap data without strict CORS
      fetch(`https://photon.komoot.io/reverse?lon=${initialCoords.lng}&lat=${initialCoords.lat}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.features && data.features.length > 0) {
            const props = data.features[0].properties;
            const addressParts = [
              props.name,
              props.housenumber ? props.housenumber + (props.street ? ' ' + props.street : '') : props.street,
              props.district,
              props.city || props.county,
              props.state,
              props.country
            ].filter(Boolean);
            
            // Remove duplicates (e.g. city and state might be the same)
            const uniqueParts = [...new Set(addressParts)];
            setNewLoc(prev => ({ ...prev, address: uniqueParts.join(', ') }));
          } else {
            setNewLoc(prev => ({ ...prev, address: '' }));
          }
        })
        .catch(err => {
          console.error('Geocoding error:', err);
          setNewLoc(prev => ({ ...prev, address: '' }));
        });
    }
  }, [initialCoords]);

  // Set default category when categories are loaded
  React.useEffect(() => {
    if (categories && categories.length > 0 && !newLoc.category_id) {
      setNewLoc(prev => ({ ...prev, category_id: categories[0].id }));
    }
  }, [categories, newLoc.category_id]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFiles([file]);
    setPreviews([URL.createObjectURL(file)]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
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
    if (newLoc.name && newLoc.category_id) {
      const submission = {
        ...newLoc,
        files: selectedFiles
      };
      onAdd(submission);
      onClose();
      resetForm();
      setNewLoc({ name: '', type: 'Học tập', description: '', image_url: '' });
    }
  };

  const resetForm = () => {
    setNewLoc({ 
      name: '', 
      category_id: categories?.[0]?.id || '', 
      description: '', 
      address: '',
      latitude: 10.762622,
      longitude: 106.660172
    });
    setSelectedFiles([]);
    setPreviews([]);
    setIsCategoryOpen(false);
  };

  const selectedCategory = categories?.find(c => c.id === newLoc.category_id);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm địa điểm mới" width={450}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Tên địa điểm</label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Ví dụ: Thư viện B..." 
            value={newLoc.name} 
            onChange={e => setNewLoc({...newLoc, name: e.target.value})} 
            style={{ background: 'white', border: '1px solid var(--hairline)' }}
          />
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Loại địa điểm</label>
            <button 
              type="button"
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className="btn-secondary" 
              style={{ 
                display: 'flex', alignItems: 'center', gap: 8, 
                background: 'white', width: '100%', 
                justifyContent: 'space-between', padding: '11px 16px',
                border: '1px solid var(--hairline)',
                height: 48,
                color: newLoc.category_id ? 'var(--body)' : 'var(--mute)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedCategory?.name || 'Chọn danh mục'}
              </div>
              <ChevronDown size={18} style={{ transform: isCategoryOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }} />
            </button>

            {isCategoryOpen && (
              <div style={{ 
                position: 'absolute', top: '105%', left: 0, width: '100%', 
                background: 'white', borderRadius: 'var(--rounded-md)', 
                boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 1000,
                overflow: 'hidden', padding: '8px', border: '1px solid var(--hairline)',
                maxHeight: 240, overflowY: 'auto'
              }}>
                {categories?.map(cat => (
                  <div 
                    key={cat.id}
                    onClick={() => { setNewLoc({...newLoc, category_id: cat.id}); setIsCategoryOpen(false); }}
                    style={{ 
                      padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                      cursor: 'pointer', fontSize: 14, fontWeight: newLoc.category_id === cat.id ? 700 : 500,
                      background: newLoc.category_id === cat.id ? 'var(--surface-soft)' : 'transparent',
                      color: newLoc.category_id === cat.id ? 'var(--primary)' : 'var(--body)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = newLoc.category_id === cat.id ? 'var(--surface-soft)' : 'transparent'}
                  >
                    {cat.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Địa chỉ</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Số nhà, tên đường..." 
              value={newLoc.address} 
              onChange={e => setNewLoc({...newLoc, address: e.target.value})} 
              style={{ background: 'white', border: '1px solid var(--hairline)' }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Mô tả</label>
          <textarea 
            className="input-field" 
            placeholder="Chia sẻ cảm nhận về địa điểm này..." 
            style={{ height: 80, resize: 'none', padding: '12px 20px', background: 'white', border: '1px solid var(--hairline)' }} 
            value={newLoc.description} 
            onChange={e => setNewLoc({...newLoc, description: e.target.value})} 
          />
        </div>

        <div style={{ display: 'flex', gap: 12, padding: 12, background: 'var(--surface-soft)', borderRadius: 'var(--rounded-md)', alignItems: 'center' }}>
          <MapPin size={20} color="var(--primary)" />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700 }}>Tọa độ hiện tại</p>
            <p style={{ fontSize: 11, opacity: 0.7 }}>{newLoc.latitude.toFixed(6)}, {newLoc.longitude.toFixed(6)}</p>
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
            {previews.length === 0 && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                style={{ width: '100%', paddingTop: '100%', border: '2px dashed var(--hairline)', borderRadius: 'var(--rounded-sm)', position: 'relative', cursor: 'pointer', background: 'var(--surface-soft)' }}
              >
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={20} color="var(--mute)" />
                </div>
              </div>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
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

