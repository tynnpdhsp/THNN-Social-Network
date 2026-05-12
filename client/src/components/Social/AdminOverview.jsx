import React from 'react';
import { Users, FileText, AlertTriangle, Activity, TrendingUp, Lock } from 'lucide-react';

const AdminOverview = ({ stats, reports, logs, setActiveSection, setResolveId, onViewProfile }) => {
  const card = { background: 'white', borderRadius: 'var(--rounded-lg)', padding: 24, border: '1px solid var(--hairline)' };

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Người dùng', value: stats.total_users || 0, color: 'var(--focus-outer)', icon: <Users size={20} /> },
          { label: 'Bài viết', value: stats.total_posts || 0, color: '#f59e0b', icon: <FileText size={20} /> },
          { label: 'Báo cáo mới', value: stats.pending_reports || 0, color: 'var(--primary)', icon: <AlertTriangle size={20} /> },
          { label: 'Hoạt động 24h', value: stats.active_users_24h || 0, color: '#8b5cf6', icon: <Activity size={20} /> },
          { label: 'Doanh thu', value: (stats.total_revenue || 0).toLocaleString('vi-VN') + ' đ', color: '#10b981', icon: <TrendingUp size={20} /> },
          { label: 'Bị khóa', value: stats.total_banned_users || 0, color: '#6b7280', icon: <Lock size={20} /> },
        ].map((s, i) => (
          <div key={i} style={{ ...card, borderBottom: `3px solid ${s.color}`, animation: `fadeInUp 0.3s ease ${i * 0.05}s both` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: s.color, marginBottom: 8 }}>
              {s.icon}
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ash)' }}>{s.label}</span>
            </div>
            <p style={{ fontSize: 24, fontWeight: 800 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick report summary */}
      {reports.filter(r => r.status === 'pending').length > 0 && (
        <div style={{ ...card, borderLeft: '4px solid var(--primary)', marginBottom: 24 }}>
          <h4 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={16} /> Báo cáo cần xử lý
          </h4>
          {reports.filter(r => r.status === 'pending').slice(0, 3).map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--surface-card)' }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>{r.target_type}</span>
                <span style={{ fontSize: 13, marginLeft: 8 }}>— {r.reason}</span>
                <span style={{ fontSize: 11, color: 'var(--ash)', marginLeft: 8 }}>bởi {r.reporter_name}</span>
              </div>
              <button onClick={() => { setActiveSection('reports'); setResolveId(r.id); }} className="btn-primary" style={{ padding: '4px 14px', fontSize: 11 }}>
                Xử lý
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recent logs preview */}
      <div style={card}>
        <h4 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={16} color="var(--mute)" /> Hoạt động gần đây
        </h4>
        {logs.slice(0, 5).map(l => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--surface-card)', fontSize: 12 }}>
            <span style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              color: l.severity === 'critical' ? 'var(--primary)' : l.severity === 'warning' ? '#f59e0b' : 'var(--focus-outer)',
              background: l.severity === 'critical' ? '#fef2f2' : l.severity === 'warning' ? '#fffbeb' : '#eff6ff'
            }}>{l.severity}</span>
            <span style={{ fontWeight: 700, flex: 1 }}>{l.action}</span>
            <span style={{ color: 'var(--ash)' }}>{new Date(l.created_at).toLocaleString('vi-VN')}</span>
          </div>
        ))}
        {logs.length === 0 && <p style={{ textAlign: 'center', color: 'var(--ash)', padding: 20 }}>Trống</p>}
      </div>
    </div>
  );
};

export default AdminOverview;
