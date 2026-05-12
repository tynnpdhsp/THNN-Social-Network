import React from 'react';
import { FileText } from 'lucide-react';

const AdminLogs = ({ logs }) => {
  const card = { background: 'white', borderRadius: 'var(--rounded-lg)', padding: 24, border: '1px solid var(--hairline)' };

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
              <th style={{ padding: 10, textAlign: 'left', fontWeight: 700, color: 'var(--ash)', textTransform: 'uppercase' }}>Mức độ</th>
              <th style={{ padding: 10, textAlign: 'left', fontWeight: 700, color: 'var(--ash)', textTransform: 'uppercase' }}>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--ash)' }}>Trống</td></tr>
            ) : logs.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--surface-card)' }}>
                <td style={{ padding: 10, color: 'var(--ash)', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('vi-VN')}</td>
                <td style={{ padding: 10, fontWeight: 700 }}>{l.action}</td>
                <td style={{ padding: 10 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    color: l.severity === 'critical' ? 'var(--primary)' : l.severity === 'warning' ? '#f59e0b' : 'var(--focus-outer)',
                    background: l.severity === 'critical' ? '#fef2f2' : l.severity === 'warning' ? '#fffbeb' : '#eff6ff'
                  }}>{l.severity}</span>
                </td>
                <td style={{ padding: 10, color: 'var(--mute)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.payload ? JSON.stringify(l.payload).substring(0, 80) : '-'}
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
