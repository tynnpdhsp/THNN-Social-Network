import React, { useState } from 'react';
import { Camera, Edit3 } from 'lucide-react';
import { apiFetch, resolveImageUrl, getDefaultAvatar } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const Profile = () => {
  const { user, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const avatar = resolveImageUrl(user.avatar_url) || getDefaultAvatar(user.full_name);
  const cover = resolveImageUrl(user.cover_url);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await apiFetch('/account/me/avatar', { method: 'PUT', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Cập nhật ảnh đại diện thất bại: ${err.detail || res.statusText}`);
        return;
      }
      refreshProfile();
    } catch (err) {
      alert('Không thể tải ảnh. Kiểm tra kết nối server/MinIO.');
      console.error('Avatar upload error:', err);
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await apiFetch('/account/me/cover', { method: 'PUT', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Cập nhật ảnh bìa thất bại: ${err.detail || res.statusText}`);
        return;
      }
      refreshProfile();
    } catch (err) {
      alert('Không thể tải ảnh. Kiểm tra kết nối server/MinIO.');
      console.error('Cover upload error:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await apiFetch('/account/me', {
      method: 'PUT',
      body: JSON.stringify({ full_name: fullName, bio }),
    });
    refreshProfile();
    setSaving(false);
    setEditing(false);
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ ...s.card, animation: 'fadeInUp 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}>
        {/* Cover */}
        <div style={s.coverWrapper}>
          {cover ? (
            <img src={cover} alt="cover" style={s.coverImg} />
          ) : (
            <div style={s.coverPlaceholder} />
          )}
          <label style={s.coverBtn}>
            <Camera size={16} color="white" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>Đổi ảnh bìa</span>
            <input type="file" accept="image/*" hidden onChange={handleCoverUpload} />
          </label>
        </div>

        {/* Avatar & Info */}
        <div style={s.infoSection}>
          <div style={s.avatarWrapper}>
            <img src={avatar} alt="avatar" style={s.avatarImg}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.18)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)'; }}
            />
            <label style={s.avatarBtn}>
              <Camera size={14} color="white" />
              <input type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
            </label>
          </div>

          {editing ? (
            <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeInUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }}>
              <input
                type="text"
                className="input-field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Họ và tên"
                style={{ textAlign: 'center', fontWeight: 700, fontSize: 18 }}
              />
              <textarea
                className="input-field"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Giới thiệu bản thân..."
                style={{ resize: 'none', height: 60, textAlign: 'center', padding: '10px 20px' }}
              />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn-secondary" onClick={() => setEditing(false)}>Hủy</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 12 }}>{user.full_name}</h2>
              <p style={{ fontSize: 14, color: 'var(--mute)', marginTop: 2 }}>{user.email}</p>
              {user.bio && <p style={{ fontSize: 14, color: 'var(--body)', marginTop: 8, maxWidth: 400, textAlign: 'center' }}>{user.bio}</p>}
              <button
                onClick={() => { setFullName(user.full_name); setBio(user.bio || ''); setEditing(true); }}
                className="btn-secondary"
                style={{ marginTop: 16, gap: 8, display: 'flex', alignItems: 'center' }}
              >
                <Edit3 size={16} /> Chỉnh sửa thông tin
              </button>
            </>
          )}

          {/* Stats */}
          <div style={s.statsRow}>
            <div style={s.stat}>
              <p style={s.statNum}>—</p>
              <p style={s.statLabel}>Bài viết</p>
            </div>
            <div style={{ width: 1, height: 32, background: 'var(--hairline)' }} />
            <div style={s.stat}>
              <p style={s.statNum}>—</p>
              <p style={s.statLabel}>Bạn bè</p>
            </div>
          </div>
        </div>
      </div>

      {/* Role badge */}
      <div style={{ textAlign: 'center', marginTop: 16, animation: 'popIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both' }}>
        <span style={{
          padding: '6px 20px',
          borderRadius: 'var(--rounded-full)',
          background: user.role === 'admin' ? '#fef2f2' : 'var(--surface-card)',
          color: user.role === 'admin' ? 'var(--primary)' : 'var(--body)',
          fontWeight: 700,
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          {user.role}
        </span>
      </div>
    </div>
  );
};

const s = {
  card: {
    background: 'white',
    borderRadius: 'var(--rounded-lg)',
    overflow: 'hidden',
    border: '1px solid var(--hairline)',
  },
  coverWrapper: {
    height: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  coverImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #e60023 0%, #cc001f 50%, #8b0015 100%)',
  },
  coverBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(8px)',
    borderRadius: 'var(--rounded-full)',
    padding: '8px 16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  infoSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 32px 32px',
    marginTop: -64,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImg: {
    width: 128,
    height: 128,
    borderRadius: 24,
    border: '4px solid white',
    objectFit: 'cover',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    background: 'white',
    transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  avatarBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  statsRow: {
    display: 'flex',
    gap: 32,
    marginTop: 24,
    paddingTop: 20,
    borderTop: '1px solid var(--surface-card)',
  },
  stat: {
    textAlign: 'center',
  },
  statNum: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--ink)',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--ash)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
};

export default Profile;
