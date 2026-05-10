import React, { useState } from 'react';
import { Camera, DollarSign } from 'lucide-react';
import Modal from '../Common/Modal';

const AddProductModal = ({ isOpen, onClose, onAdd, categories = [], productToEdit = null }) => {
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    category: categories.length > 0 ? categories[0].id : '',
    description: '',
  });
  const [images, setImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayPrice, setDisplayPrice] = useState('');
  const fileInputRef = React.useRef(null);

  React.useEffect(() => {
    if (isOpen) {
      if (productToEdit) {
        setFormData({
          title: productToEdit.title,
          price: productToEdit.price,
          category: productToEdit.category_id || '',
          description: productToEdit.description,
        });
        setDisplayPrice(productToEdit.price?.toLocaleString() || '');
      } else {
        setFormData({
          title: '',
          price: '',
          category: categories.length > 0 ? categories[0].id : '',
          description: '',
        });
        setDisplayPrice('');
      }
      setImages([]);
    }
  }, [isOpen, productToEdit, categories]);

  const handlePriceChange = (e) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (!isNaN(rawValue) || rawValue === '') {
      setFormData({ ...formData, price: rawValue });
      setDisplayPrice(rawValue ? Number(rawValue).toLocaleString() : '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.title && formData.price) {
      setIsSubmitting(true);
      try {
        await onAdd(formData, images);
        setFormData({ title: '', price: '', category: categories.length > 0 ? categories[0].id : '', description: '' });
        setImages([]);
        onClose();
      } catch (error) {
        alert("Failed to add product: " + error.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleImageChange = (e) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={productToEdit ? "Cập nhật vật phẩm" : "Đăng bán vật phẩm mới"} width={500}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {!productToEdit && (
          <>
            <div 
              onClick={() => fileInputRef.current.click()}
              style={{ border: '2px dashed var(--hairline)', padding: '40px 20px', borderRadius: 'var(--rounded-md)', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-soft)' }}
            >
               <Camera size={40} color="var(--ash)" style={{ marginBottom: 12 }} />
               <p className="body-strong" style={{ color: 'var(--mute)' }}>Tải lên hình ảnh sản phẩm</p>
               <p className="caption-sm">PNG, JPG tối đa 10MB</p>
               {images.length > 0 && <p style={{ color: 'var(--primary)', marginTop: 8 }}>Đã chọn {images.length} ảnh</p>}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              multiple 
              accept="image/png, image/jpeg" 
              onChange={handleImageChange} 
            />
          </>
        )}

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
                type="text" 
                placeholder="0" 
                className="input-field search-bar"
                value={displayPrice}
                onChange={handlePriceChange}
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
              disabled={!!productToEdit}
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
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
          <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }} disabled={isSubmitting}>Hủy</button>
          <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
            {isSubmitting ? 'Đang xử lý...' : (productToEdit ? 'Lưu thay đổi' : 'Đăng bán ngay')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddProductModal;
