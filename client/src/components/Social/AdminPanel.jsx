import React, { useState, useEffect, useCallback } from 'react';
import { Users, FileText, AlertTriangle, Shield, Lock, Unlock, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../Common/Modal';

const AdminPanel = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [reportFilter, setReportFilter] = useState('pending');
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [resolveId, setResolveId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [sRes, rRes, uRes, lRes] = await Promise.all([
        apiFetch('/admin/stats/overview'),
        apiFetch(`/admin/reports?limit=50${reportFilter ? `&status=${reportFilter}` : ''}`),
        apiFetch(`/admin/users?limit=50${userFilter === 'locked' ? '&is_locked=true' : userFilter === 'active' ? '&is_locked=false' : ''}`),
        apiFetch('/admin/audit-logs?limit=20'),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (rRes.ok) { const d = await rRes.json(); setReports(d.reports || []); }
      if (uRes.ok) { const d = await uRes.json(); setUsers(d.users || []); }
      if (lRes.ok) { const d = await lRes.json(); setLogs(d.logs || []); }
    } catch {}
    setLoading(false);
  }, [reportFilter, userFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const lockUser = async (id) => {
    const reason = prompt('Lý do khóa:');
    if (!reason) return;
    await apiFetch(`/admin/users/${id}/lock`, { method: 'POST', body: JSON.stringify({ reason }) });
    loadAll();
  };

  const unlockUser = async (id) => {
    await apiFetch(`/admin/users/${id}/unlock`, { method: 'POST' });
    loadAll();
  };

  const updateRole = async (id, role) => {
    await apiFetch(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
    loadAll();
  };

  const resolve = async (action) => {
    await apiFetch(`/admin/reports/${resolveId}/resolve`, { method: 'POST', body: JSON.stringify({ action }) });
    setResolveId(null);
    loadAll();
  };

  const filtered = userSearch ? users.filter(u => u.full_name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())) : users;

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div style={{ width: 32, height: 32, border: '3px solid var(--hairline)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;

  const card = { background: 'white', borderRadius: 'var(--rounded-lg)', padding: 24, border: '1px solid var(--hairline)', marginBottom: 24 };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Shield size={24} color="var(--primary)" /> Quản trị hệ thống
      </h2>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Người dùng', value: stats.total_users || 0, color: 'var(--focus-outer)', icon: <Users size={20} /> },
          { label: 'Bài viết', value: stats.total_posts || 0, color: '#f59e0b', icon: <FileText size={20} /> },
          { label: 'Báo cáo mới', value: stats.pending_reports || 0, color: 'var(--primary)', icon: <AlertTriangle size={20} /> },
        ].map((s, i) => (
          <div key={i} style={{ ...card, marginBottom: 0, borderBottom: `3px solid ${s.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: s.color, marginBottom: 8 }}>{s.icon}<span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ash)' }}>{s.label}</span></div>
            <p style={{ fontSize: 32, fontWeight: 800 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Reports */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 18 }}>🚩 Báo cáo vi phạm</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input-field" style={{ height: 36, width: 140, fontSize: 12, padding: '0 12px' }} value={reportFilter} onChange={e => setReportFilter(e.target.value)}>
              <option value="pending">Đang chờ</option>
              <option value="resolved">Đã xử lý</option>
              <option value="dismissed">Bỏ qua</option>
              <option value="">Tất cả</option>
            </select>
            <button onClick={loadAll} className="btn-secondary" style={{ width: 36, height: 36, padding: 0 }}><RefreshCw size={14} /></button>
          </div>
        </div>
        {reports.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--ash)', padding: 32 }}>Không có báo cáo</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map(r => (
              <div key={r.id} style={{ background: 'var(--surface-soft)', padding: 16, borderRadius: 16, border: '1px solid var(--hairline)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', background: '#fef2f2', color: 'var(--primary)', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{r.target_type}</span>
                      <span style={{ padding: '2px 8px', background: 'var(--surface-card)', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{r.status}</span>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>Lý do: <span style={{ color: 'var(--primary)' }}>{r.reason}</span></p>
                    {r.target_preview && <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 4, fontStyle: 'italic' }}>"{r.target_preview}"</p>}
                    <p style={{ fontSize: 11, color: 'var(--ash)', marginTop: 6 }}>Bởi: {r.reporter_name} • {new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  {r.status === 'pending' && (
                    <button onClick={() => setResolveId(r.id)} className="btn-primary" style={{ padding: '6px 16px', fontSize: 11, flexShrink: 0 }}>GIẢI QUYẾT</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Management */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 18 }}>👥 Quản lý người dùng</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" className="input-field" placeholder="Tìm..." style={{ height: 36, width: 160, fontSize: 12, padding: '0 14px' }} value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            <select className="input-field" style={{ height: 36, width: 130, fontSize: 12, padding: '0 12px' }} value={userFilter} onChange={e => setUserFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="locked">Bị khóa</option>
              <option value="active">Hoạt động</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(u => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--ash)' }}>{u.full_name?.[0]}</div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>{u.full_name} {u.id === user?.id ? '(Bạn)' : ''}</p>
                  <p style={{ fontSize: 11, color: 'var(--ash)' }}>{u.email} • <span style={{ fontWeight: 700, color: u.role === 'admin' ? 'var(--primary)' : 'var(--focus-outer)', textTransform: 'uppercase' }}>{u.role}</span></p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select onChange={e => updateRole(u.id, e.target.value)} value={u.role} style={{ fontSize: 11, background: 'var(--surface-soft)', border: 'none', padding: '4px 8px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                  <option value="student">STUDENT</option>
                  <option value="admin">ADMIN</option>
                </select>
                {u.is_locked ? (
                  <button onClick={() => unlockUser(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}><Unlock size={12} /> MỞ</button>
                ) : (
                  <button onClick={() => lockUser(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', background: '#fef2f2', color: 'var(--primary)', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}><Lock size={12} /> KHÓA</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Logs */}
      <div style={card}>
        <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>📜 Nhật ký hệ thống</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
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
                  <td style={{ padding: 10, color: 'var(--ash)' }}>{new Date(l.created_at).toLocaleString()}</td>
                  <td style={{ padding: 10, fontWeight: 700 }}>{l.action}</td>
                  <td style={{ padding: 10 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: l.severity === 'critical' ? 'var(--primary)' : l.severity === 'warning' ? '#f59e0b' : 'var(--focus-outer)', background: l.severity === 'critical' ? '#fef2f2' : l.severity === 'warning' ? '#fffbeb' : '#eff6ff' }}>{l.severity}</span>
                  </td>
                  <td style={{ padding: 10, color: 'var(--mute)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.payload ? JSON.stringify(l.payload).substring(0, 60) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolve Modal */}
      <Modal isOpen={!!resolveId} onClose={() => setResolveId(null)} title="Xử lý vi phạm" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { action: 'hide_content', label: 'Ẩn nội dung', color: '#f59e0b', bg: '#fffbeb' },
            { action: 'lock_account', label: 'Khóa tài khoản', color: 'var(--primary)', bg: '#fef2f2' },
            { action: 'dismiss', label: 'Bỏ qua báo cáo', color: 'var(--body)', bg: 'var(--surface-card)' },
          ].map(a => (
            <button key={a.action} onClick={() => resolve(a.action)} style={{ padding: 16, borderRadius: 16, border: 'none', background: a.bg, color: a.color, fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left', transition: 'opacity 0.2s' }}>{a.label}</button>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default AdminPanel;
