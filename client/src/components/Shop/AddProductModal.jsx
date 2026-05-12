import React, { useState } from 'react';
import { Camera, DollarSign, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
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
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
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
        toast.error("Lỗi: " + error.message);
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

  const selectedCategoryLabel = categories.find(c => c.id === formData.category)?.name || 'Chọn danh mục...';

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
            style={{ background: 'white', border: '1px solid var(--hairline)' }}
            value={formData.title}
            onChange={e => setFormData({...formData, title: e.target.value})}
            required
          />
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Giá bán</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="0" 
                className="input-field"
                style={{ background: 'white', border: '1px solid var(--hairline)', paddingRight: 45 }}
                value={displayPrice}
                onChange={handlePriceChange}
                required
              />
              <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute)', fontSize: 14, fontWeight: 600 }}>đ</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Danh mục</label>
            <div style={{ position: 'relative' }}>
              <button 
                type="button"
                onClick={() => !productToEdit && setIsCategoryOpen(!isCategoryOpen)}
                className="input-field"
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: productToEdit ? 'not-allowed' : 'pointer',
                  background: 'white', border: '1px solid var(--hairline)',
                  padding: '0 16px', height: 44, width: '100%', textAlign: 'left'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedCategoryLabel}</span>
                {!productToEdit && <ChevronDown size={18} style={{ transform: isCategoryOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }} />}
              </button>
              
              {isCategoryOpen && (
                <div style={{ 
                  position: 'absolute', top: '100%', left: 0, width: '100%', 
                  background: 'white', borderRadius: 'var(--rounded-md)', 
                  boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 1000,
                  overflow: 'hidden', padding: '8px', border: '1px solid var(--hairline)',
                  marginTop: 4
                }}>
                  {categories.map(cat => (
                    <div 
                      key={cat.id}
                      onClick={() => { setFormData({...formData, category: cat.id}); setIsCategoryOpen(false); }}
                      style={{ 
                        padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                        cursor: 'pointer', fontSize: 14, fontWeight: formData.category === cat.id ? 700 : 500,
                        background: formData.category === cat.id ? 'var(--surface-soft)' : 'transparent',
                        color: formData.category === cat.id ? 'var(--primary)' : 'var(--body)',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = formData.category === cat.id ? 'var(--surface-soft)' : 'transparent'}
                    >
                      {cat.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Mô tả sản phẩm</label>
          <textarea 
            placeholder="Mô tả tình trạng, nội dung sản phẩm..." 
            className="input-field"
            style={{ height: 100, resize: 'none', padding: '12px 20px', background: 'white', border: '1px solid var(--hairline)' }}
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
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
