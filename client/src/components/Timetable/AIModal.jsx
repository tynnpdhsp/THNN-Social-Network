import React from 'react';
import { Sparkles } from 'lucide-react';
import Modal from '../Common/Modal';

const AIModal = ({ isOpen, onClose, onOptimize }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} width={450}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Sparkles size={32} color="var(--primary)" />
        <h2 className="heading-lg">AI Trợ lý Thời khóa biểu</h2>
      </div>
      <p className="body-md" style={{ marginBottom: 24, color: 'var(--mute)' }}>Hãy chọn các tiêu chí để AI tối ưu lịch học cho bạn:</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
        {[
          { id: 'minDays', label: 'Giảm tối đa số ngày học trong tuần' },
          { id: 'noEvening', label: 'Tránh các tiết học buổi tối' },
          { id: 'noGap', label: 'Hạn chế các khoảng nghỉ giữa tiết (trống tiết)' },
          { id: 'morningOnly', label: 'Ưu tiên học buổi sáng' },
        ].map(item => (
          <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 20, height: 20, accentColor: 'var(--primary)' }} />
            <span style={{ fontWeight: 500 }}>{item.label}</span>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Hủy bỏ</button>
        <button className="btn-primary" style={{ flex: 1, background: 'var(--ink)' }} onClick={onOptimize}>
          Tạo phương án tối ưu
        </button>
      </div>
    </Modal>
  );
};

export default AIModal;
