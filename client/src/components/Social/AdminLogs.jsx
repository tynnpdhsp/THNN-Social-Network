import React from 'react';
import { FileText } from 'lucide-react';

const AdminLogs = ({ logs }) => {
  const card = { background: 'white', borderRadius: 'var(--rounded-lg)', padding: 24, border: '1px solid var(--hairline)' };

  const formatPayload = (action, payload) => {
    if (!payload) return '-';
    try {
      const p = typeof payload === 'string' ? JSON.parse(payload) : payload;
      const targetName = p.target_name || p.target_user_id?.substring(0,8) || p.target_id?.substring(0,8) || 'N/A';
      
      const actionMap = {
        'hide_content': 'Ẩn nội dung',
        'lock_account': 'Khóa tài khoản',
        'dismiss': 'Bỏ qua'
      };

      switch (action) {
        case 'Khóa tài khoản':
          return `Khóa người dùng "${targetName}". Lý do: ${p.reason || 'Không có'}`;
        case 'Mở khóa tài khoản':
          return `Mở khóa người dùng "${targetName}"`;
        case 'Xử lý báo cáo':
          return `Xử lý báo cáo vi phạm. Hành động: ${actionMap[p.action] || p.action}. Đối tượng: ${targetName}`;
        case 'Cập nhật vai trò':
          return `Gán vai trò "${p.new_role}" cho "${targetName}"`;
        default:
          return JSON.stringify(p);
      }
    } catch (e) { return '-'; }
  };

  return (
    <div style={{ ...card, animation: 'fadeInUp 0.3s ease' }}>
      <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <FileText size={20} color="var(--primary)" /> Nhật ký hệ thống
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--hairline)' }}>
              <th style={{ padding: 10, textAlign: 'left', fontWeight: 700, color: 'var(--ash)', textTransform: 'uppercase' }}>Thời gian</th>
              <th style={{ padding: 10, textAlign: 'left', fontWeight: 700, color: 'var(--ash)', textTransform: 'uppercase' }}>Hành động</th>
              <th style={{ padding: 10, textAlign: 'left', fontWeight: 700, color: 'var(--ash)', textTransform: 'uppercase' }}>Người thực hiện</th>
              <th style={{ padding: 10, textAlign: 'left', fontWeight: 700, color: 'var(--ash)', textTransform: 'uppercase' }}>Mức độ</th>
              <th style={{ padding: 10, textAlign: 'left', fontWeight: 700, color: 'var(--ash)', textTransform: 'uppercase' }}>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--ash)' }}>Trống</td></tr>
            ) : logs.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--surface-card)' }}>
                <td style={{ padding: 10, color: 'var(--ash)', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('vi-VN')}</td>
                <td style={{ padding: 10, fontWeight: 700 }}>{l.action}</td>
                <td style={{ padding: 10, color: 'var(--ink)' }}>{l.admin_name}</td>
                <td style={{ padding: 10 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    color: l.severity === 'critical' || l.severity === 'warning' ? 'var(--primary)' : 'var(--focus-outer)',
                    background: l.severity === 'critical' || l.severity === 'warning' ? '#fef2f2' : '#eff6ff'
                  }}>{l.severity === 'warning' ? 'Cảnh báo' : 'Thông tin'}</span>
                </td>
                <td style={{ padding: 10, color: 'var(--mute)', maxWidth: 450, lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {formatPayload(l.action, l.payload)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminLogs;
