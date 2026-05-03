import React from 'react';
import { Download } from 'lucide-react';
import Modal from '../Common/Modal';

const ImportModal = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Lớp học phần" width={500}>
      <p className="body-md" style={{ marginBottom: 24 }}>Chọn file dữ liệu từ cổng thông tin đào tạo (.xlsx, .json) hoặc nhập mã sinh viên để đồng bộ.</p>

      <div style={{ border: '2px dashed var(--hairline)', padding: 48, borderRadius: 'var(--rounded-md)', textAlign: 'center', marginBottom: 24 }}>
        <Download size={48} style={{ color: 'var(--mute)', marginBottom: 16 }} />
        <p style={{ fontWeight: 600 }}>Kéo thả file vào đây hoặc nhấn để chọn</p>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Hủy</button>
        <button className="btn-primary" style={{ flex: 1 }}>Bắt đầu Import</button>
      </div>
    </Modal>
  );
};

export default ImportModal;
