import React, { useState } from 'react';
import { FileText, Download, Share2, MoreVertical, Folder, Upload, Filter, Star, ChevronDown } from 'lucide-react';
import DocDetailModal from './DocDetailModal';
import UploadDocModal from './UploadDocModal';

const initialDocuments = [
  { id: 1, name: 'Đề cương ôn tập Toán cao cấp 1', type: 'PDF', size: '2.4 MB', date: '02/05/2026', author: 'Lê Văn A', rating: 4.8, category: 'Công nghệ thông tin', description: 'Tài liệu chi tiết các chương ôn tập môn Toán cao cấp 1 cho sinh viên năm nhất.' },
  { id: 2, name: 'Slide bài giảng Kinh tế vĩ mô - Chương 3', type: 'PPTX', size: '15.8 MB', date: '01/05/2026', author: 'Nguyễn Thị B', rating: 4.2, category: 'Kinh tế & Marketing', description: 'Slide tóm tắt các kiến thức trọng tâm chương 3 về cung cầu và thị trường.' },
  { id: 3, name: 'Báo cáo thực tập doanh nghiệp - Mẫu chuẩn', type: 'DOCX', size: '1.2 MB', date: '28/04/2026', author: 'Trần Văn C', rating: 4.5, category: 'Kỹ thuật', description: 'Mẫu báo cáo thực tập chuẩn theo quy định của nhà trường.' },
  { id: 4, name: 'Tổng hợp công thức Vật lý hạt nhân', type: 'PDF', size: '850 KB', date: '25/04/2026', author: 'Phạm Minh D', rating: 5.0, category: 'Kỹ thuật', description: 'Tất cả công thức quan trọng cần nhớ cho kỳ thi cuối kỳ môn Vật lý.' },
  { id: 5, name: 'Dataset bài tập Machine Learning', type: 'CSV', size: '45.2 MB', date: '20/04/2026', author: 'Đặng Thu E', rating: 3.9, category: 'Công nghệ thông tin', description: 'Dữ liệu thô dùng cho các bài tập thực hành môn Machine Learning.' },
];

const StudyDocs = () => {
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const sortOptions = [
    { value: 'date', label: 'Mới nhất' },
    { value: 'rating', label: 'Đánh giá cao' },
  ];

  const categories = ['Tất cả', ...new Set(initialDocuments.map(d => d.category))];

  const filteredDocs = documents.filter(doc => 
    activeCategory === 'Tất cả' || doc.category === activeCategory
  );

  const sortedDocs = [...filteredDocs].sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating;
    return new Date(b.date.split('/').reverse().join('-')) - new Date(a.date.split('/').reverse().join('-'));
  });

  const handleUpload = (newDoc) => {
    const doc = {
      ...newDoc,
      id: Date.now(),
      type: 'PDF',
      size: '1.2 MB',
      date: new Date().toLocaleDateString('vi-VN'),
      rating: 5.0,
    };
    setDocuments([doc, ...documents]);
  };

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div style={{ display: 'flex', gap: 32 }}>
        {/* Sidebar */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <button 
            className="btn-primary" 
            style={{ width: '100%', marginBottom: 32, height: 48 }}
            onClick={() => setShowUploadModal(true)}
          >
            <Upload size={20} />
            Tải lên tài liệu
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h3 className="caption-sm" style={{ padding: '0 12px 8px', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Bộ sưu tập</h3>
              {['Đã lưu', 'Của tôi', 'Thùng rác'].map((item, i) => (
                <button key={item} style={{ 
                  textAlign: 'left', padding: '12px', border: 'none', borderRadius: 'var(--rounded-md)', 
                  background: 'transparent', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  color: 'var(--mute)'
                }}>
                  <Folder size={18} />
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h1 className="heading-xl">Tài liệu học tập</h1>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="btn-secondary" 
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: 8, 
                    background: 'var(--surface-card)', minWidth: 160, 
                    justifyContent: 'space-between', padding: '10px 20px' 
                  }}
                >
                  {sortOptions.find(o => o.value === sortBy).label}
                  <ChevronDown size={18} style={{ transform: isSortOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                </button>
                
                {isSortOpen && (
                  <div style={{ 
                    position: 'absolute', top: '120%', right: 0, width: '100%', 
                    background: 'white', borderRadius: 'var(--rounded-md)', 
                    boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 500,
                    overflow: 'hidden', padding: '8px', border: '1px solid var(--hairline)'
                  }}>
                    {sortOptions.map(option => (
                      <div 
                        key={option.value}
                        onClick={() => { setSortBy(option.value); setIsSortOpen(false); }}
                        style={{ 
                          padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                          cursor: 'pointer', fontSize: 14, fontWeight: sortBy === option.value ? 700 : 500,
                          background: sortBy === option.value ? 'var(--surface-soft)' : 'transparent',
                          color: sortBy === option.value ? 'var(--primary)' : 'var(--body)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = sortBy === option.value ? 'var(--surface-soft)' : 'transparent'}
                      >
                        {option.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="btn-secondary" 
                  style={{ 
                    display: 'flex', gap: 8, alignItems: 'center', 
                    background: 'var(--surface-card)',
                    color: 'var(--ink)'
                  }}
                >
                  <Filter size={18} /> {activeCategory === 'Tất cả' ? 'Lọc' : activeCategory}
                </button>

                {isFilterOpen && (
                  <div style={{ 
                    position: 'absolute', top: '120%', right: 0, width: 220, 
                    background: 'white', borderRadius: 'var(--rounded-md)', 
                    boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 500,
                    overflow: 'hidden', padding: '8px', border: '1px solid var(--hairline)'
                  }}>
                    {categories.map(cat => (
                      <div 
                        key={cat}
                        onClick={() => { setActiveCategory(cat); setIsFilterOpen(false); }}
                        style={{ 
                          padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                          cursor: 'pointer', fontSize: 14, fontWeight: activeCategory === cat ? 700 : 500,
                          background: activeCategory === cat ? 'var(--surface-soft)' : 'transparent',
                          color: activeCategory === cat ? 'var(--primary)' : 'var(--body)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = activeCategory === cat ? 'var(--surface-soft)' : 'transparent'}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 'var(--rounded-lg)', border: '1px solid var(--hairline)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface-soft)', borderBottom: '1px solid var(--hairline)' }}>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Tên tài liệu</th>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Phân loại</th>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Đánh giá</th>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Ngày tải lên</th>
                  <th style={{ padding: '16px', fontWeight: 600 }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedDocs.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--hairline)', cursor: 'pointer' }} onClick={() => setSelectedDoc(doc)}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, background: 'var(--surface-card)', borderRadius: 'var(--rounded-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={20} color="var(--primary)" />
                        </div>
                        <div>
                          <p style={{ fontWeight: 600 }}>{doc.name}</p>
                          <p className="caption-sm">Tác giả: {doc.author} • {doc.size}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ padding: '4px 8px', background: 'var(--secondary-bg)', borderRadius: 'var(--rounded-full)', fontSize: 12, fontWeight: 700 }}>
                        {doc.category}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Star size={14} fill="#ffc107" color="#ffc107" />
                        <span style={{ fontWeight: 700 }}>{doc.rating}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--mute)' }}>{doc.date}</td>
                    <td style={{ padding: '16px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}><Download size={18} /></button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}><Share2 size={18} /></button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}><MoreVertical size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <DocDetailModal 
        isOpen={!!selectedDoc} 
        onClose={() => setSelectedDoc(null)} 
        doc={selectedDoc || {}} 
      />

      <UploadDocModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
      />
    </div>
  );
};

export default StudyDocs;
