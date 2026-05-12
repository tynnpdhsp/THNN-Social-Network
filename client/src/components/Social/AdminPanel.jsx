import React, { useState, useEffect, useCallback } from 'react';
import { Users, FileText, Shield, Flag, Eye, EyeOff, TrendingUp, Lock } from 'lucide-react';
import { apiFetch } from '../../config/api';
import Modal from '../Common/Modal';
import AdminOverview from './AdminOverview';
import AdminUsers from './AdminUsers';
import AdminReports from './AdminReports';
import AdminLogs from './AdminLogs';

const AdminPanel = ({ onViewProfile }) => {
  const [stats, setStats] = useState({});
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [reportFilter, setReportFilter] = useState('pending');
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
    } catch (err) { console.error('Error loading admin panel data:', err); }
    setLoading(false);
  }, [reportFilter, userFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const lockUserSubmit = async (id, reason) => {
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--hairline)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

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
            {n.badge > 0 && (
              <span style={{ background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>
                {n.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Section Content Delegates */}
      {activeSection === 'overview' && (
        <AdminOverview
          stats={stats}
          reports={reports}
          logs={logs}
          setActiveSection={setActiveSection}
          setResolveId={setResolveId}
          onViewProfile={onViewProfile}
        />
      )}

      {activeSection === 'users' && (
        <AdminUsers
          users={users}
          userFilter={userFilter}
          setUserFilter={setUserFilter}
          loadAll={loadAll}
          onViewProfile={onViewProfile}
          onUnlockUser={unlockUser}
          onUpdateRole={updateRole}
          onLockUserSubmit={lockUserSubmit}
        />
      )}

      {activeSection === 'reports' && (
        <AdminReports
          reports={reports}
          reportFilter={reportFilter}
          setReportFilter={setReportFilter}
          loadAll={loadAll}
          setResolveId={setResolveId}
          onViewProfile={onViewProfile}
        />
      )}

      {activeSection === 'logs' && (
        <AdminLogs logs={logs} />
      )}

      {/* Shared Resolve Modal */}
      <Modal isOpen={!!resolveId} onClose={() => setResolveId(null)} title="Xử lý vi phạm" width={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--mute)', marginBottom: 8 }}>Chọn hành động xử lý cho báo cáo này:</p>
          {[
            { action: 'hide_content', label: 'Ẩn nội dung vi phạm', desc: 'Bài viết/bình luận sẽ bị ẩn khỏi hệ thống', icon: <EyeOff size={16} />, color: '#f59e0b', bg: '#fffbeb' },
            { action: 'lock_account', label: 'Khóa tài khoản vi phạm', desc: 'Người dùng sẽ không thể đăng nhập', icon: <Lock size={16} />, color: 'var(--primary)', bg: '#fef2f2' },
            { action: 'dismiss', label: 'Bỏ qua báo cáo', desc: 'Không có hành vi vi phạm', icon: <Eye size={16} />, color: 'var(--body)', bg: 'var(--surface-card)' },
          ].map(a => (
            <button
              key={a.action}
              onClick={() => resolve(a.action)}
              style={{ padding: 16, borderRadius: 16, border: 'none', background: a.bg, color: a.color, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 12 }}
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
