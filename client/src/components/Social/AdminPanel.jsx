import React, { useState, useEffect, useCallback } from 'react';
import { Users, FileText, AlertTriangle, Shield, Lock, Unlock, RefreshCw, Flag, Eye, EyeOff, TrendingUp, Activity } from 'lucide-react';
import { apiFetch, resolveImageUrl, getDefaultAvatar } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../Common/Modal';

const AdminPanel = ({ onViewProfile }) => {
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
  const [activeSection, setActiveSection] = useState('overview');

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

  const card = { background: 'white', borderRadius: 'var(--rounded-lg)', padding: 24, border: '1px solid var(--hairline)' };
  const navItems = [
    { key: 'overview', label: 'Tổng quan', icon: <TrendingUp size={16} /> },
    { key: 'users', label: 'Người dùng', icon: <Users size={16} /> },
    { key: 'reports', label: 'Báo cáo', icon: <Flag size={16} />, badge: stats.pending_reports },
    { key: 'logs', label: 'Nhật ký', icon: <FileText size={16} /> },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Shield size={24} color="var(--primary)" /> Quản trị hệ thống
      </h2>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: 'var(--surface-soft)', borderRadius: 'var(--rounded-full)', padding: 4 }}>
        {navItems.map(n => (
          <button
            key={n.key}
            onClick={() => setActiveSection(n.key)}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 'var(--rounded-full)', border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: activeSection === n.key ? 'white' : 'transparent',
              color: activeSection === n.key ? 'var(--ink)' : 'var(--mute)',
              boxShadow: activeSection === n.key ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.25s ease',
            }}
          >
            {n.icon} {n.label}
            {n.badge > 0 && <span style={{ background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{n.badge}</span>}
          </button>
        ))}
      </div>

      {/* === OVERVIEW === */}
      {activeSection === 'overview' && (
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: s.color, marginBottom: 8 }}>{s.icon}<span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ash)' }}>{s.label}</span></div>
                <p style={{ fontSize: 24, fontWeight: 800 }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Quick report summary */}
          {reports.filter(r => r.status === 'pending').length > 0 && (
            <div style={{ ...card, borderLeft: '4px solid var(--primary)', marginBottom: 24 }}>
              <h4 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={16} /> Báo cáo cần xử lý</h4>
              {reports.filter(r => r.status === 'pending').slice(0, 3).map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--surface-card)' }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>{r.target_type}</span>
                    <span style={{ fontSize: 13, marginLeft: 8 }}>— {r.reason}</span>
                    <span style={{ fontSize: 11, color: 'var(--ash)', marginLeft: 8 }}>bởi {r.reporter_name}</span>
                  </div>
                  <button onClick={() => { setActiveSection('reports'); setResolveId(r.id); }} className="btn-primary" style={{ padding: '4px 14px', fontSize: 11 }}>Xử lý</button>
                </div>
              ))}
            </div>
          )}

          {/* Recent logs preview */}
          <div style={card}>
            <h4 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={16} color="var(--mute)" /> Hoạt động gần đây</h4>
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
      )}

      {/* === USERS === */}
      {activeSection === 'users' && (
        <div style={{ ...card, animation: 'fadeInUp 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={20} color="var(--primary)" /> Quản lý người dùng ({filtered.length})
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" className="input-field" placeholder="Tìm theo tên, email..." style={{ height: 36, width: 200, fontSize: 12, padding: '0 14px' }} value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              <select className="input-field" style={{ height: 36, width: 130, fontSize: 12, padding: '0 12px' }} value={userFilter} onChange={e => setUserFilter(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="locked">Bị khóa</option>
                <option value="active">Hoạt động</option>
              </select>
              <button onClick={loadAll} className="btn-secondary" style={{ width: 36, height: 36, padding: 0 }}><RefreshCw size={14} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(u => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: u.is_locked ? '#fef2f2' : 'white', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--hairline)', transition: 'all 0.2s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => onViewProfile?.(u.id)}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--ash)', fontSize: 16 }}>{u.full_name?.[0]}</div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>
                      {u.full_name} {u.id === user?.id ? <span style={{ fontSize: 10, color: 'var(--focus-outer)', fontWeight: 800 }}>(BẠN)</span> : ''}
                      {u.is_locked && <span style={{ fontSize: 10, color: 'var(--primary)', marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 2 }}><Lock size={10} /> ĐÃ KHÓA</span>}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--ash)' }}>
                      {u.email} • <span style={{ fontWeight: 700, color: u.role === 'admin' ? 'var(--primary)' : 'var(--focus-outer)', textTransform: 'uppercase' }}>{u.role}</span>
                      {u.last_login_at && <> • Đăng nhập: {new Date(u.last_login_at).toLocaleDateString('vi-VN')}</>}
                    </p>
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
      )}

      {/* === REPORTS === */}
      {activeSection === 'reports' && (
        <div style={{ ...card, animation: 'fadeInUp 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Flag size={20} color="var(--primary)" /> Báo cáo vi phạm
            </h3>
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
                <div key={r.id} style={{ background: 'var(--surface-soft)', padding: 16, borderRadius: 16, border: r.status === 'pending' ? '1px solid var(--primary)' : '1px solid var(--hairline)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 8px', background: '#fef2f2', color: 'var(--primary)', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{r.target_type}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                          background: r.status === 'pending' ? '#fffbeb' : r.status === 'resolved' ? '#f0fdf4' : 'var(--surface-card)',
                          color: r.status === 'pending' ? '#f59e0b' : r.status === 'resolved' ? '#16a34a' : 'var(--mute)'
                        }}>{r.status === 'pending' ? 'Đang chờ' : r.status === 'resolved' ? 'Đã xử lý' : 'Bỏ qua'}</span>
                        {r.resolved_action && <span style={{ padding: '2px 8px', background: 'var(--surface-card)', borderRadius: 6, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>{r.resolved_action === 'hide_content' ? <><EyeOff size={10} /> Ẩn nội dung</> : r.resolved_action === 'lock_account' ? <><Lock size={10} /> Khóa TK</> : <><Eye size={10} /> Bỏ qua</>}</span>}
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 700 }}>Lý do: <span style={{ color: 'var(--primary)' }}>{r.reason}</span></p>
                      {r.description && <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>Mô tả: {r.description}</p>}
                      {r.target_preview && <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 6, fontStyle: 'italic', padding: '8px 12px', background: 'white', borderRadius: 8, borderLeft: '3px solid var(--hairline)' }}>"{r.target_preview}"</div>}
                      <p style={{ fontSize: 11, color: 'var(--ash)', marginTop: 6 }}>Bởi: <span style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--focus-outer)' }} onClick={() => onViewProfile?.(r.reporter_id)}>{r.reporter_name}</span> • {new Date(r.created_at).toLocaleString('vi-VN')}</p>
                    </div>
                    {r.status === 'pending' && (
                      <button onClick={() => setResolveId(r.id)} className="btn-primary" style={{ padding: '6px 16px', fontSize: 11, flexShrink: 0, marginLeft: 12 }}>GIẢI QUYẾT</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === LOGS === */}
      {activeSection === 'logs' && (
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
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: l.severity === 'critical' ? 'var(--primary)' : l.severity === 'warning' ? '#f59e0b' : 'var(--focus-outer)', background: l.severity === 'critical' ? '#fef2f2' : l.severity === 'warning' ? '#fffbeb' : '#eff6ff' }}>{l.severity}</span>
                    </td>
                    <td style={{ padding: 10, color: 'var(--mute)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.payload ? JSON.stringify(l.payload).substring(0, 80) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      <Modal isOpen={!!resolveId} onClose={() => setResolveId(null)} title="Xử lý vi phạm" width={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--mute)', marginBottom: 8 }}>Chọn hành động xử lý cho báo cáo này:</p>
          {[
            { action: 'hide_content', label: 'Ẩn nội dung vi phạm', desc: 'Bài viết/bình luận sẽ bị ẩn khỏi hệ thống', icon: <EyeOff size={16} />, color: '#f59e0b', bg: '#fffbeb' },
            { action: 'lock_account', label: 'Khóa tài khoản vi phạm', desc: 'Người dùng sẽ không thể đăng nhập', icon: <Lock size={16} />, color: 'var(--primary)', bg: '#fef2f2' },
            { action: 'dismiss', label: 'Bỏ qua báo cáo', desc: 'Không có hành vi vi phạm', icon: <Eye size={16} />, color: 'var(--body)', bg: 'var(--surface-card)' },
          ].map(a => (
            <button key={a.action} onClick={() => resolve(a.action)} style={{ padding: 16, borderRadius: 16, border: 'none', background: a.bg, color: a.color, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 12 }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
            >
              {a.icon}
              <div>
                <p style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</p>
                <p style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default AdminPanel;
