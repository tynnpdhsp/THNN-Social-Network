import React, { useState, useRef } from 'react';
import { Upload, FileText, Tag, Info, Loader2, ChevronDown } from 'lucide-react';
import Modal from '../Common/Modal';
import * as documentService from '../../services/documentService';

const UploadDocModal = ({ isOpen, onClose, onUploadSuccess, categories }) => {
  const [formData, setFormData] = useState({
    title: '',
    category_id: '',
    description: '',
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Vui lòng chọn tệp tài liệu');
      return;
    }
    if (!formData.title) {
      setError('Vui lòng nhập tiêu đề');
      return;
    }
    if (!formData.category_id) {
      setError('Vui lòng chọn danh mục');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await documentService.uploadDocument({
        ...formData,
        file
      });
      onUploadSuccess();
      setFormData({ title: '', category_id: '', description: '' });
      setFile(null);
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra khi tải lên');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('Tệp quá lớn (tối đa 50MB)');
        return;
      }
      setFile(selectedFile);
      setError('');
      if (!formData.title) {
        const name = selectedFile.name.replace(/\.[^/.]+$/, "");
        setFormData({ ...formData, title: name });
      }
    }
  };

  const selectedCategory = categories?.find(c => c.id === formData.category_id);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tải lên tài liệu mới" width={540}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 0' }}>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
          accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.csv"
        />
        
        <div 
          onClick={() => fileInputRef.current.click()}
          style={{ 
            border: '2px dashed var(--hairline)', 
            padding: '40px 20px', 
            borderRadius: 'var(--rounded-md)', 
            textAlign: 'center', 
            cursor: 'pointer', 
            background: 'var(--surface-soft)',
            transition: 'all 0.2s',
            borderColor: file ? 'var(--primary)' : 'var(--hairline)'
          }} 
          onMouseEnter={e => !file && (e.currentTarget.style.borderColor = 'var(--primary)')}
          onMouseLeave={e => !file && (e.currentTarget.style.borderColor = 'var(--hairline)')}
        >
           {file ? (
             <>
               <div style={{ width: 48, height: 48, background: 'var(--surface-card)', borderRadius: 'var(--rounded-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                 <FileText size={24} color="var(--primary)" />
               </div>
               <p className="body-strong" style={{ color: 'var(--ink)' }}>{file.name}</p>
               <p className="caption-sm">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
               <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} style={{ marginTop: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Thay đổi tệp</button>
             </>
           ) : (
             <>
               <Upload size={40} color="var(--primary)" style={{ marginBottom: 12 }} />
               <p className="body-strong">Chọn tệp tài liệu hoặc kéo thả vào đây</p>
               <p className="caption-sm">PDF, DOCX, PPTX, TXT tối đa 50MB</p>
             </>
           )}
        </div>

        {error && <p style={{ color: 'var(--danger)', fontSize: 14, fontWeight: 500, padding: '0 4px' }}>{error}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Tiêu đề tài liệu</label>
            <div className="search-container" style={{ width: '100%' }}>
              <FileText size={18} />
              <input 
                type="text" 
                placeholder="Ví dụ: Đề cương Giải tích 1..." 
                className="input-field search-bar"
                style={{ background: 'white', border: '1px solid var(--hairline)' }}
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                required
              />
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Phân loại</label>
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
                color: formData.category_id ? 'var(--body)' : 'var(--mute)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Tag size={18} color="var(--mute)" />
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
                    onClick={() => { setFormData({...formData, category_id: cat.id}); setIsCategoryOpen(false); }}
                    style={{ 
                      padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                      cursor: 'pointer', fontSize: 14, fontWeight: formData.category_id === cat.id ? 700 : 500,
                      background: formData.category_id === cat.id ? 'var(--surface-soft)' : 'transparent',
                      color: formData.category_id === cat.id ? 'var(--primary)' : 'var(--body)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = formData.category_id === cat.id ? 'var(--surface-soft)' : 'transparent'}
                  >
                    {cat.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Mô tả ngắn gọn</label>
          <div className="search-container">
            <Info size={18} style={{ top: 16 }} />
            <textarea 
              placeholder="Tài liệu này bao gồm những gì?..." 
              className="input-field search-bar"
              style={{ height: 100, resize: 'none', padding: '12px 20px 12px 44px', background: 'white', border: '1px solid var(--hairline)' }}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1, height: 48 }} disabled={loading}>Hủy</button>
          <button type="submit" className="btn-primary" style={{ flex: 1, gap: 8, height: 48 }} disabled={loading || !file}>
            {loading && <Loader2 className="animate-spin" size={18} />}
            {loading ? 'Đang tải lên...' : 'Bắt đầu tải lên'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default UploadDocModal;
