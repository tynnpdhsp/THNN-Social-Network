import React, { useState } from 'react';
import { Users, Lock, Unlock, RefreshCw, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveImageUrl } from '../../config/api';
import Modal from '../Common/Modal';

const CustomDropdown = ({ value, options, onChange, style, width = 130, buttonStyle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find(o => o.value === value)?.label || '';

  return (
    <div style={{ position: 'relative', width, ...style }} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', height: 36, padding: '0 12px',
          background: 'white', border: '1px solid var(--hairline)',
          borderRadius: 'var(--rounded-full)', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, fontWeight: 700, color: 'var(--ink)',
          cursor: 'pointer', transition: 'all 0.2s', ...buttonStyle
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0, marginLeft: 4 }} />
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setIsOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: 'white', borderRadius: 'var(--rounded-md)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 100,
            overflow: 'hidden', padding: 6, border: '1px solid var(--hairline)',
            animation: 'scaleIn 0.15s ease'
          }}>
            {options.map(o => (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setIsOpen(false); }}
                style={{
                  padding: '8px 10px', borderRadius: 'var(--rounded-sm)',
                  cursor: 'pointer', fontSize: 12, fontWeight: value === o.value ? 700 : 500,
                  background: value === o.value ? 'var(--surface-soft)' : 'transparent',
                  color: value === o.value ? 'var(--primary)' : 'var(--body)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-soft)'}
                onMouseLeave={e => e.currentTarget.style.background = value === o.value ? 'var(--surface-soft)' : 'transparent'}
              >
                {o.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const filterOptions = [
  { value: '', label: 'Tất cả' },
  { value: 'locked', label: 'Bị khóa' },
  { value: 'active', label: 'Hoạt động' },
];

const roleOptions = [
  { value: 'student', label: 'STUDENT' },
  { value: 'admin', label: 'ADMIN' },
];

const AdminUsers = ({ users, userFilter, setUserFilter, loadAll, onViewProfile, onUnlockUser, onUpdateRole, onLockUserSubmit }) => {
  const { user } = useAuth();
  const [userSearch, setUserSearch] = useState('');
  const [userToLock, setUserToLock] = useState(null);
  const [lockReason, setLockReason] = useState('');

  const filtered = userSearch
    ? users.filter(u => u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()))
    : users;

  console.log("u", filtered)

  const handleConfirmLock = () => {
    if (!lockReason.trim() || !userToLock) return;
    onLockUserSubmit(userToLock, lockReason);
    setUserToLock(null);
    setLockReason('');
  };

  const card = { background: 'white', borderRadius: 'var(--rounded-lg)', padding: 24, border: '1px solid var(--hairline)' };

  return (
    <div style={{ ...card, animation: 'fadeInUp 0.3s ease' }}>
      <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={20} color="var(--primary)" /> Quản lý người dùng ({filtered.length})
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="input-field"
            placeholder="Tìm theo tên, email..."
            style={{ height: 36, width: 200, fontSize: 12, padding: '0 14px', background: 'white', border: '1px solid var(--hairline)' }}
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
          />
          <CustomDropdown
            value={userFilter}
            options={filterOptions}
            onChange={setUserFilter}
            width={130}
          />
          <button onClick={loadAll} className="btn-secondary" style={{ width: 36, height: 36, padding: 0 }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(u => (
          <div key={u.id} className="admin-user-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: u.is_locked ? '#fef2f2' : 'white', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--hairline)', transition: 'all 0.2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => onViewProfile?.(u.id)}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--ash)', fontSize: 16 }}>
                {u?.avatar_url ? <img src={resolveImageUrl(u.avatar_url)} style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--ash)', fontSize: 16 }}/> : u.full_name?.[0]}
              </div>
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
              <CustomDropdown
                value={u.role}
                options={roleOptions}
                onChange={newRole => onUpdateRole(u.id, newRole)}
                width={100}
                buttonStyle={{ height: 28, fontSize: 11, background: 'var(--surface-soft)', border: 'none', borderRadius: 8 }}
              />
              {u.is_locked ? (
                <button onClick={() => onUnlockUser(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', height: 28, background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                  <Unlock size={12} /> MỞ
                </button>
              ) : (
                <button onClick={() => setUserToLock(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', height: 28, background: '#fef2f2', color: 'var(--primary)', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                  <Lock size={12} /> KHÓA
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lock Confirmation Modal */}
      <Modal isOpen={!!userToLock} onClose={() => { setUserToLock(null); setLockReason(''); }} title="Lý do khóa tài khoản" width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--body)' }}>Vui lòng nhập lý do khóa tài khoản này:</p>
          <input
            type="text"
            placeholder="Ví dụ: Vi phạm tiêu chuẩn cộng đồng..."
            className="input-field"
            style={{ height: 44, background: 'white', border: '1px solid var(--hairline)', width: '100%' }}
            value={lockReason}
            onChange={e => setLockReason(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button className="btn-secondary" onClick={() => { setUserToLock(null); setLockReason(''); }}>
              Hủy
            </button>
            <button className="btn-primary" onClick={handleConfirmLock} disabled={!lockReason.trim()}>
              Xác nhận khóa
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminUsers;
