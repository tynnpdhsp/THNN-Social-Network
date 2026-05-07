import React, { useState } from 'react';
import { Upload, FileText, Tag, Info } from 'lucide-react';
import Modal from '../Common/Modal';

const UploadDocModal = ({ isOpen, onClose, onUpload }) => {
  const [formData, setFormData] = useState({
    name: '',
    category: 'Công nghệ thông tin',
    description: '',
    author: 'Người dùng'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name) {
      onUpload(formData);
      onClose();
      setFormData({ name: '', category: 'Công nghệ thông tin', description: '', author: 'Người dùng' });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tải lên tài liệu mới" width={500}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ 
          border: '2px dashed var(--hairline)', 
          padding: '40px 20px', 
          borderRadius: 'var(--rounded-md)', 
          textAlign: 'center', 
          cursor: 'pointer', 
          background: 'var(--surface-soft)',
          transition: 'all 0.2s'
        }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
           onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--hairline)'}>
           <Upload size={40} color="var(--primary)" style={{ marginBottom: 12 }} />
           <p className="body-strong">Chọn tệp tài liệu hoặc kéo thả vào đây</p>
           <p className="caption-sm">PDF, DOCX, PPTX tối đa 50MB</p>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Tiêu đề tài liệu</label>
          <div className="search-container">
            <FileText size={18} />
            <input 
              type="text" 
              placeholder="Ví dụ: Đề cương Giải tích 1..." 
              className="input-field search-bar"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Phân loại</label>
          <div className="search-container">
            <Tag size={18} />
            <select 
              className="input-field search-bar"
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
            >
              <option value="Công nghệ thông tin">Công nghệ thông tin</option>
              <option value="Kinh tế & Marketing">Kinh tế & Marketing</option>
              <option value="Kỹ thuật">Kỹ thuật</option>
              <option value="Ngoại ngữ">Ngoại ngữ</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Mô tả ngắn gọn</label>
          <div className="search-container">
            <Info size={18} style={{ top: 16 }} />
            <textarea 
              placeholder="Tài liệu này bao gồm những gì?..." 
              className="input-field search-bar"
              style={{ height: 100, resize: 'none', padding: '12px 20px 12px 44px' }}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Hủy</button>
          <button type="submit" className="btn-primary" style={{ flex: 1 }}>Bắt đầu tải lên</button>
        </div>
      </form>
    </Modal>
  );
};

export default UploadDocModal;
