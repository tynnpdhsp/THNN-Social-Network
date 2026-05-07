import React, { useState } from 'react';
import { Camera, DollarSign } from 'lucide-react';
import Modal from '../Common/Modal';

const AddProductModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    category: 'supplies',
    description: '',
    image: null
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.title && formData.price) {
      onAdd(formData);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Đăng bán vật phẩm mới" width={500}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ border: '2px dashed var(--hairline)', padding: '40px 20px', borderRadius: 'var(--rounded-md)', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-soft)' }}>
           <Camera size={40} color="var(--ash)" style={{ marginBottom: 12 }} />
           <p className="body-strong" style={{ color: 'var(--mute)' }}>Tải lên hình ảnh sản phẩm</p>
           <p className="caption-sm">PNG, JPG tối đa 10MB</p>
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
