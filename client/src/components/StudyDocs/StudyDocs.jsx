import { useState, useEffect } from 'react';
import { FileText, Download, Share2, MoreVertical, Upload, Filter, Star, ChevronDown, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import DocDetailModal from './DocDetailModal';
import UploadDocModal from './UploadDocModal';
import DeleteConfirmModal from '../Shop/DeleteConfirmModal';
import Modal from '../Common/Modal';
import * as documentService from '../../services/documentService';
import toast from 'react-hot-toast';
import { resolveImageUrl } from '../../config/api';

const StudyDocs = () => {
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([{ id: 'all', name: 'Tất cả' }]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState({ id: 'all', name: 'Tất cả' });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [totalDocs, setTotalDocs] = useState(0);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [docToDelete, setDocToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reportDoc, setReportDoc] = useState(null);
  const [reportReason, setReportReason] = useState('Nội dung không phù hợp');
  const [reportDesc, setReportDesc] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [isReportReasonOpen, setIsReportReasonOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const DOCS_PER_PAGE = 5;

  const sortOptions = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'rating', label: 'Đánh giá cao' },
    { value: 'oldest', label: 'Cũ nhất' },
  ];

  useEffect(() => {
    fetchCategories();
  }, []);


  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, sortBy, currentPage]);

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null);
      setIsSortOpen(false);
      setIsFilterOpen(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  async function fetchCategories() {
    try {
      const data = await documentService.getDocumentCategories();
      setCategories([{ id: 'all', name: 'Tất cả' }, ...data]);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  async function fetchDocuments() {
    setLoading(true);
    try {
      const params = {
        sort: sortBy,
        limit: DOCS_PER_PAGE,
        skip: (currentPage - 1) * DOCS_PER_PAGE,
      };
      if (activeCategory.id !== 'all') {
        params.category_id = activeCategory.id;
      }
      const data = await documentService.getDocuments(params);
      setDocuments(data.items);
      setTotalDocs(data.total);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const handleUploadSuccess = () => {
    fetchDocuments();
    setShowUploadModal(false);
  };

  const handleUpdateDoc = (updatedDoc) => {
    setDocuments(prev => prev.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc));
    if (selectedDoc?.id === updatedDoc.id) {
      setSelectedDoc(updatedDoc);
    }
  };

  const handleShare = (doc, e) => {
    e.stopPropagation();
    const url = resolveImageUrl(doc.file_url);
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Đã sao chép liên kết tải tài liệu!');
    }).catch(() => {
      toast.error('Không thể sao chép liên kết');
    });
    setActiveMenuId(null);
  };

  const handleDeleteClick = (doc, e) => {
    if (e) e.stopPropagation();
    setDocToDelete(doc);
    setIsDeleteModalOpen(true);
    setActiveMenuId(null);
  };

  const handleReportSubmit = async () => {
    if (!reportDoc) return;
    setIsReporting(true);
    try {
      await documentService.reportDocument(reportDoc.id, { reason: reportReason, description: reportDesc });
      toast.success('Đã gửi báo cáo tài liệu thành công');
      setReportDoc(null);
      setReportReason('Nội dung không phù hợp');
      setReportDesc('');
    } catch (err) {
      toast.error('Lỗi khi gửi báo cáo: ' + err.message);
    } finally {
      setIsReporting(false);
    }
  };

  const handleDownload = async (doc, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const url = resolveImageUrl(doc.file_url);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = doc.file_name || 'document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      a.remove();
    } catch (error) {
      console.warn("Fetch download failed, falling back to direct link", error);
      const a = document.createElement('a');
      a.href = resolveImageUrl(doc.file_url);
      a.download = doc.file_name || 'document';
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setActiveMenuId(null);
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    try {
      await documentService.deleteDocument(docToDelete.id);
      fetchDocuments();
      setIsDeleteModalOpen(false);
      setDocToDelete(null);
      toast.success('Đã xoá tài liệu thành công');
    } catch (error) {
      toast.error('Lỗi khi xoá tài liệu: ' + error.message);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 80 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header with Upload button and Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="heading-xl">Tài liệu học tập</h1>
        </div>
            <div className="docs-action-bar" style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsSortOpen(!isSortOpen); setIsFilterOpen(false); }}
                    className="btn-secondary" 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 8, 
                      background: 'var(--surface-card)', minWidth: 160, 
                      justifyContent: 'space-between', padding: '10px 20px' 
                    }}
                  >
                    {sortOptions.find(o => o.value === sortBy)?.label || 'Mới nhất'}
                    <ChevronDown size={18} style={{ transform: isSortOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                  </button>
                  
                  {isSortOpen && (
                    <div 
                      onClick={e => e.stopPropagation()}
                      style={{ 
                      position: 'absolute', top: '120%', left: 0, width: '100%', 
                      background: 'white', borderRadius: 'var(--rounded-md)', 
                      boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 500,
                      overflow: 'hidden', padding: '8px', border: '1px solid var(--hairline)'
                    }}>
                      {sortOptions.map(option => (
                        <div 
                          key={option.value}
                          onClick={() => { setSortBy(option.value); setCurrentPage(1); setIsSortOpen(false); }}
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
                    onClick={(e) => { e.stopPropagation(); setIsFilterOpen(!isFilterOpen); setIsSortOpen(false); }}
                    className="btn-secondary" 
                    style={{ 
                      display: 'flex', gap: 8, alignItems: 'center', 
                      background: 'var(--surface-card)',
                      color: 'var(--ink)'
                    }}
                  >
                    <Filter size={18} /> {activeCategory.name}
                  </button>

                  {isFilterOpen && (
                    <div 
                      onClick={e => e.stopPropagation()}
                      style={{ 
                      position: 'absolute', top: '120%', left: 0, width: 220, 
                      background: 'white', borderRadius: 'var(--rounded-md)', 
                      boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 500,
                      overflow: 'hidden', padding: '8px', border: '1px solid var(--hairline)'
                    }}>
                      {categories.map(cat => (
                        <div 
                          key={cat.id}
                          onClick={() => { setActiveCategory(cat); setCurrentPage(1); setIsFilterOpen(false); }}
                          style={{ 
                            padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                            cursor: 'pointer', fontSize: 14, fontWeight: activeCategory.id === cat.id ? 700 : 500,
                            background: activeCategory.id === cat.id ? 'var(--surface-soft)' : 'transparent',
                            color: activeCategory.id === cat.id ? 'var(--primary)' : 'var(--body)',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = activeCategory.id === cat.id ? 'var(--surface-soft)' : 'transparent'}
                        >
                          {cat.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button 
                className="btn-primary" 
                style={{ height: 44, padding: '0 24px' }}
                onClick={() => setShowUploadModal(true)}
              >
                <Upload size={18} />
                Tải lên tài liệu
              </button>
            </div>

          <div style={{ 
            background: 'white', 
            borderRadius: 'var(--rounded-lg)', 
            border: '1px solid var(--hairline)', 
            overflowX: 'auto',
            overflowY: 'hidden', 
            position: 'relative', 
            height: 421, // Precise fixed height
            display: 'flex',
            flexDirection: 'column'
          }}>
            {loading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                <Loader2 className="animate-spin" size={40} color="var(--primary)" />
              </div>
            )}
            
            <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
                {documents.length > 0 ? (
                  documents.map((doc) => (
                    <tr key={doc.id} style={{ borderBottom: '1px solid var(--hairline)', cursor: 'pointer' }} onClick={() => setSelectedDoc(doc)}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 40, height: 40, background: 'var(--surface-card)', borderRadius: 'var(--rounded-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={20} color="var(--primary)" />
                          </div>
                          <div>
                            <p style={{ fontWeight: 600 }}>{doc.title}</p>
                            <p className="caption-sm">Tác giả: {doc.user_info?.full_name || 'Ẩn danh'} • {formatFileSize(doc.file_size)}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ padding: '4px 10px', background: 'var(--secondary-bg)', borderRadius: 'var(--rounded-full)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {doc.category?.name || 'Chưa phân loại'}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Star size={14} fill="#ffc107" color="#ffc107" />
                          <span style={{ fontWeight: 700 }}>{doc.avg_rating.toFixed(1)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--mute)' }}>{formatDate(doc.created_at)}</td>
                      <td style={{ padding: '16px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                          <button 
                            onClick={(e) => handleDownload(doc, e)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }} 
                            title="Tải xuống"
                          >
                            <Download size={18} />
                          </button>
                          <button 
                            onClick={(e) => handleShare(doc, e)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }} 
                            title="Chia sẻ"
                          >
                            <Share2 size={18} />
                          </button>
                          <div style={{ position: 'relative' }}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === doc.id ? null : doc.id); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}
                            >
                              <MoreVertical size={18} />
                            </button>
                            
                            {activeMenuId === doc.id && (
                              <div style={{ 
                                position: 'absolute', top: '100%', right: 0, width: 180, 
                                background: 'white', borderRadius: 'var(--rounded-md)', 
                                boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 1000,
                                overflow: 'hidden', padding: '8px', border: '1px solid var(--hairline)'
                              }}>
                                <div 
                                  onClick={(e) => handleShare(doc, e)}
                                  style={{ padding: '10px 12px', borderRadius: 'var(--rounded-sm)', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <Share2 size={14} /> Sao chép liên kết
                                </div>
                                <div 
                                  onClick={(e) => { e.stopPropagation(); setReportDoc(doc); setActiveMenuId(null); }}
                                  style={{ padding: '10px 12px', borderRadius: 'var(--rounded-sm)', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <AlertTriangle size={14} /> Báo cáo vi phạm
                                </div>
                                <div 
                                  onClick={(e) => handleDeleteClick(doc, e)}
                                  style={{ padding: '10px 12px', borderRadius: 'var(--rounded-sm)', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', color: '#ff4d4f' }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <Download size={14} style={{ transform: 'rotate(180deg)' }} /> Xoá tài liệu
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  !loading && (
                    <tr>
                      <td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: 'var(--mute)' }}>
                        Không tìm thấy tài liệu nào.
                      </td>
                    </tr>
                  )
                )}
                {/* Placeholder rows to keep height consistent */}
                {!loading && documents.length < 5 && Array.from({ length: 5 - documents.length }).map((_, i) => (
                  <tr key={`empty-${i}`} style={{ borderBottom: 'none' }}>
                    <td colSpan="5" style={{ padding: '16px' }}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination back outside */}
          {totalDocs > DOCS_PER_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 24 }}>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="btn-secondary"
                style={{ width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={20} />
              </button>
              
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                Trang {currentPage} / {Math.ceil(totalDocs / DOCS_PER_PAGE)}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalDocs / DOCS_PER_PAGE), prev + 1))}
                disabled={currentPage >= Math.ceil(totalDocs / DOCS_PER_PAGE)}
                className="btn-secondary"
                style={{ width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentPage >= Math.ceil(totalDocs / DOCS_PER_PAGE) ? 0.5 : 1, cursor: currentPage >= Math.ceil(totalDocs / DOCS_PER_PAGE) ? 'not-allowed' : 'pointer' }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

      <DocDetailModal 
        isOpen={!!selectedDoc} 
        onClose={() => setSelectedDoc(null)} 
        doc={selectedDoc || {}} 
        onUpdateDoc={handleUpdateDoc}
      />

      <UploadDocModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={handleUploadSuccess}
        categories={categories.filter(c => c.id !== 'all')}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        itemName={docToDelete?.title || ""}
        itemType="tài liệu"
      />

      <Modal isOpen={!!reportDoc} onClose={() => setReportDoc(null)} title="Báo cáo tài liệu" width={420} overflow="visible">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, display: 'block' }}>Lý do</label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsReportReasonOpen(!isReportReasonOpen)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  background: 'white', border: '1px solid var(--hairline)',
                  borderRadius: 'var(--rounded-md)', padding: '0 16px',
                  fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                  cursor: 'pointer', height: 40, width: '100%'
                }}
              >
                <span>{reportReason}</span>
                <ChevronDown size={16} />
              </button>

              {isReportReasonOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setIsReportReasonOpen(false)} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: '100%',
                    background: 'white', borderRadius: 'var(--rounded-md)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 100,
                    overflow: 'hidden', padding: 8, border: '1px solid var(--hairline)'
                  }}>
                    {['Nội dung không phù hợp', 'Spam / Lừa đảo', 'Vi phạm bản quyền', 'Tài liệu sai lệch', 'Khác'].map(r => (
                      <div
                        key={r}
                        onClick={() => { setReportReason(r); setIsReportReasonOpen(false); }}
                        style={{
                          padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                          cursor: 'pointer', fontSize: 13, fontWeight: reportReason === r ? 700 : 500,
                          background: reportReason === r ? 'var(--surface-soft)' : 'transparent',
                          color: reportReason === r ? 'var(--primary)' : 'var(--body)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = reportReason === r ? 'var(--surface-soft)' : 'transparent'}
                      >
                        {r}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, display: 'block' }}>Mô tả chi tiết (không bắt buộc)</label>
            <textarea
              className="input-field"
              placeholder="Vui lòng cung cấp thêm thông tin..."
              style={{ height: 100, resize: 'none', padding: '12px 16px', fontSize: 13 }}
              value={reportDesc}
              onChange={(e) => setReportDesc(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setReportDoc(null)}>Hủy</button>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleReportSubmit} disabled={isReporting}>
              {isReporting ? 'Đang gửi...' : 'Gửi báo cáo'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StudyDocs;
