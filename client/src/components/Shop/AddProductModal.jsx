import React, { useState } from 'react';
import { Camera, DollarSign, X } from 'lucide-react';
import { apiFetch, resolveImageUrl } from '../../config/api';
import Modal from '../Common/Modal';

const AddProductModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    category: 'supplies',
    description: '',
    image_url: ''
  });
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
        setFormData(prev => ({ ...prev, image_url: data.image_url }));
      } else {
        alert('Tải ảnh thất bại');
      }
    } catch (err) {
      alert('Lỗi kết nối server');
    }
    setUploading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.title && formData.price) {
      onAdd(formData);
      setFormData({ title: '', price: '', category: 'supplies', description: '', image_url: '' });
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Đăng bán vật phẩm mới" width={500}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div 
          onClick={() => !formData.image_url && document.getElementById('product-image-upload').click()}
          style={{ 
            border: '2px dashed var(--hairline)', 
            padding: formData.image_url ? '10px' : '40px 20px', 
            borderRadius: 'var(--rounded-md)', 
            textAlign: 'center', 
            cursor: formData.image_url ? 'default' : 'pointer', 
            background: 'var(--surface-soft)',
            position: 'relative',
            minHeight: 120,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {formData.image_url ? (
            <div style={{ position: 'relative', width: '100%' }}>
              <img src={resolveImageUrl(formData.image_url)} alt="preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8 }} />
              <button 
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                style={{ position: 'absolute', top: 8, right: 8, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <Camera size={40} color="var(--ash)" style={{ marginBottom: 12 }} />
              <p className="body-strong" style={{ color: 'var(--mute)' }}>{uploading ? 'Đang tải lên...' : 'Tải lên hình ảnh sản phẩm'}</p>
              <p className="caption-sm">PNG, JPG tối đa 10MB</p>
            </>
          )}
          <input type="file" id="product-image-upload" hidden accept="image/*" onChange={handleUpload} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Tên sản phẩm</label>
          <input 
            type="text" 
            placeholder="Ví dụ: Giáo trình Kinh tế vi mô..." 
            className="input-field"
            value={formData.title}
            onChange={e => setFormData({...formData, title: e.target.value})}
            required
          />
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Giá bán (đ)</label>
            <div className="search-container">
              <DollarSign size={18} />
              <input 
                type="number" 
                placeholder="0" 
                className="input-field search-bar"
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
                required
              />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Danh mục</label>
            <select 
              className="input-field"
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
            >
              <option value="docs">Tài liệu</option>
              <option value="books">Giáo trình</option>
              <option value="supplies">Vật dụng</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Mô tả sản phẩm</label>
          <textarea 
            placeholder="Mô tả tình trạng, nội dung sản phẩm..." 
            className="input-field"
            style={{ height: 100, resize: 'none', padding: '12px 20px' }}
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Hủy</button>
          <button type="submit" className="btn-primary" style={{ flex: 1 }}>Đăng bán ngay</button>
        </div>
      </form>
    </Modal>
  );
};

export default AddProductModal;
