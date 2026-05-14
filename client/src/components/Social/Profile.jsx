import React, { useState, useEffect, useCallback } from 'react';
import { Camera, Edit3, Heart, MessageCircle, Image as ImageIcon, Globe, Users, Lock, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, resolveImageUrl, getDefaultAvatar } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../Common/ConfirmDialog';

const Profile = ({ targetUserId, onStartChat }) => {
  const { user: currentUser, refreshProfile } = useAuth();
  const confirm = useConfirm();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(!!targetUserId);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [friendCount, setFriendCount] = useState(0);

  const isOwnProfile = !targetUserId || targetUserId === currentUser?.id;
  const userId = isOwnProfile ? currentUser?.id : targetUserId;

  const loadProfile = useCallback(async () => {
    if (isOwnProfile) {
      setProfileUser(currentUser);
      setFullName(currentUser?.full_name || '');
      setBio(currentUser?.bio || '');
      setLoading(false);
    } else {
      setLoading(true);
      try {
        const res = await apiFetch(`/account/${targetUserId}`);
        if (res.ok) {
          const data = await res.json();
          setProfileUser(data);
          setFullName(data.full_name);
          setBio(data.bio || '');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
      setLoading(false);
    }
  }, [targetUserId, currentUser, isOwnProfile]);

  const loadPosts = useCallback(async () => {
    if (!userId) return;
    setPostsLoading(true);
    try {
      const res = await apiFetch(`/social/users/${userId}/posts?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (err) { console.error('Error loading profile:', err); }
    setPostsLoading(false);
  }, [userId]);

  const loadFriendCount = useCallback(async () => {
    if (!userId) return;
    try {
      // Use the target user's friends list if viewing another profile
      const endpoint = isOwnProfile ? '/social/friends' : `/social/friends?user_id=${userId}`;
      const res = await apiFetch('/social/friends');
      if (res.ok) {
        const data = await res.json();
        setFriendCount(Array.isArray(data) ? data.length : 0);
      }
    } catch (err) { console.error('Error loading posts:', err); }
  }, [userId, isOwnProfile]);

  useEffect(() => { loadProfile(); }, [loadProfile]);
  useEffect(() => { loadPosts(); }, [loadPosts]);
  useEffect(() => { loadFriendCount(); }, [loadFriendCount]);

  const handleLike = async (postId) => {
    try {
      await apiFetch(`/social/posts/${postId}/like`, { method: 'POST' });
      loadPosts();
    } catch (err) { console.error('Error loading friend count:', err); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div style={{ width: 32, height: 32, border: '3px solid var(--hairline)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;
  if (!profileUser) return <div style={{ textAlign: 'center', padding: 64, color: 'var(--ash)' }}>Không tìm thấy người dùng</div>;

  const avatar = resolveImageUrl(profileUser.avatar_url) || getDefaultAvatar(profileUser.full_name);
  const cover = resolveImageUrl(profileUser.cover_url);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await apiFetch('/account/me/avatar', { method: 'PUT', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(`Cập nhật ảnh đại diện thất bại: ${err.detail || res.statusText}`);
        return;
      }
      toast.success('Đã cập nhật ảnh đại diện');
      refreshProfile();
    } catch (err) {
      toast.error('Không thể tải ảnh. Kiểm tra kết nối server/MinIO.');
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
        toast.error(`Cập nhật ảnh bìa thất bại: ${err.detail || res.statusText}`);
        return;
      }
      toast.success('Đã cập nhật ảnh bìa');
      refreshProfile();
    } catch (err) {
      toast.error('Không thể tải ảnh. Kiểm tra kết nối server/MinIO.');
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

  const handleFriendAction = async (action) => {
    let url = '';
    let method = 'POST';
    if (action === 'add') url = `/social/friends/requests/${targetUserId}`;
    if (action === 'accept') url = `/social/friends/requests/${targetUserId}/accept`;
    if (action === 'reject') url = `/social/friends/requests/${targetUserId}/reject`;
    if (action === 'unfriend') {
      url = `/social/friends/${targetUserId}`;
      method = 'DELETE';
    }

    try {
      const res = await apiFetch(url, { method });
      if (res.ok) {
        loadProfile();
      }
    } catch (err) { console.error('Error uploading avatar:', err); }
  };

  const visIcon = (v) => {
    if (v === 'friends') return <Users size={11} />;
    if (v === 'private') return <Lock size={11} />;
    return <Globe size={11} />;
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
          {isOwnProfile && (
            <label style={s.coverBtn}>
              <Camera size={16} color="white" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>Đổi ảnh bìa</span>
              <input type="file" accept="image/*" hidden onChange={handleCoverUpload} />
            </label>
          )}
        </div>

        {/* Avatar & Info */}
        <div style={s.infoSection}>
          <div style={s.avatarWrapper}>
            <img src={avatar} alt="avatar" style={s.avatarImg}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.18)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)'; }}
            />
            {isOwnProfile && (
              <label style={s.avatarBtn}>
                <Camera size={14} color="white" />
                <input type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
              </label>
            )}
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
              <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 12 }}>{profileUser.full_name}</h2>
              <p style={{ fontSize: 14, color: 'var(--mute)', marginTop: 2 }}>{profileUser.email}</p>
              {profileUser.bio && <p style={{ fontSize: 14, color: 'var(--body)', marginTop: 8, maxWidth: 400, textAlign: 'center' }}>{profileUser.bio}</p>}
              
              {isOwnProfile ? (
                <button
                  onClick={() => { setFullName(profileUser.full_name); setBio(profileUser.bio || ''); setEditing(true); }}
                  className="btn-secondary"
                  style={{ marginTop: 16, gap: 8, display: 'flex', alignItems: 'center' }}
                >
                  <Edit3 size={16} /> Chỉnh sửa thông tin
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  {profileUser.friend_status === 'none' && (
                    <button className="btn-primary" style={{ padding: '8px 24px' }} onClick={() => handleFriendAction('add')}>Kết bạn</button>
                  )}
                  {profileUser.friend_status === 'pending' && (
                    <button className="btn-secondary" style={{ padding: '8px 24px', opacity: 0.8 }} disabled>Đã gửi yêu cầu</button>
                  )}
                  {profileUser.friend_status === 'pending_received' && (
                    <>
                      <button className="btn-primary" style={{ padding: '8px 20px' }} onClick={() => handleFriendAction('accept')}>Chấp nhận</button>
                      <button className="btn-secondary" style={{ padding: '8px 20px' }} onClick={() => handleFriendAction('reject')}>Từ chối</button>
                    </>
                  )}
                  {profileUser.friend_status === 'accepted' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-soft)', padding: '8px 20px', borderRadius: 'var(--rounded-full)', color: '#16a34a', fontWeight: 700, fontSize: 14 }}>
                        <Check size={14} /> Bạn bè
                      </div>
                      <button className="btn-secondary" style={{ padding: '8px 20px', color: 'var(--primary)' }} onClick={async () => {
                        const ok = await confirm({
                          title: 'Hủy kết bạn',
                          message: 'Bạn có chắc chắn muốn hủy kết bạn với người này?',
                          confirmText: 'Hủy kết bạn',
                          cancelText: 'Giữ lại',
                          variant: 'danger',
                          icon: 'unfriend',
                        });
                        if (ok) handleFriendAction('unfriend');
                      }}>Hủy kết bạn</button>
                    </>
                  )}
                  <button 
                    className="btn-secondary" 
                    style={{ padding: '8px 24px' }}
                    onClick={() => onStartChat?.(profileUser)}
                  >Nhắn tin</button>
                </div>
              )}
            </>
          )}

          {/* Stats */}
          <div style={s.statsRow}>
            <div style={s.stat}>
              <p style={s.statNum}>{posts.length}</p>
              <p style={s.statLabel}>Bài viết</p>
            </div>
            <div style={{ width: 1, height: 32, background: 'var(--hairline)' }} />
            <div style={s.stat}>
              <p style={s.statNum}>{friendCount}</p>
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
          background: profileUser.role === 'admin' ? '#fef2f2' : 'var(--surface-card)',
          color: profileUser.role === 'admin' ? 'var(--primary)' : 'var(--body)',
          fontWeight: 700,
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          {profileUser.role}
        </span>
      </div>

      {/* User Posts */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageCircle size={18} color="var(--primary)" /> Bài viết
        </h3>

        {postsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 28, height: 28, border: '3px solid var(--hairline)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, background: 'var(--surface-soft)', borderRadius: 'var(--rounded-lg)', border: '1px dashed var(--hairline)' }}>
            <p style={{ fontWeight: 700, color: 'var(--mute)' }}>Chưa có bài viết nào</p>
            <p style={{ fontSize: 13, color: 'var(--ash)', marginTop: 4 }}>{isOwnProfile ? 'Hãy chia sẻ bài viết đầu tiên của bạn!' : 'Người dùng này chưa đăng bài viết nào.'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {posts.map((p, idx) => {
              const postAvatar = resolveImageUrl(p.user_info?.avatar_url) || getDefaultAvatar(p.user_info?.full_name);
              const images = p.images || [];
              return (
                <div
                  key={p.id}
                  style={{
                    background: 'white',
                    borderRadius: 'var(--rounded-lg)',
                    border: '1px solid var(--hairline)',
                    overflow: 'hidden',
                    animation: `fadeInUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 0.06}s both`,
                    transition: 'box-shadow 0.3s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                >
                  {/* Post Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 12px' }}>
                    <img src={postAvatar} alt="" style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 14 }}>{p.user_info?.full_name}</p>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {new Date(p.created_at).toLocaleDateString('vi-VN')} • {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {visIcon(p.visibility)}
                      </p>
                    </div>
                  </div>

                  {/* Post Content */}
                  <div style={{ padding: '0 20px 12px' }}>
                    <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--body)', whiteSpace: 'pre-wrap' }}>{p.content}</p>
                  </div>

                  {/* Post Images */}
                  {images.length > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: images.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                      gap: 2,
                    }}>
                      {images.map((img, i) => {
                        const multi = images.length > 1;
                        return (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--surface-soft)',
                              minHeight: multi ? 200 : 0,
                              maxHeight: multi ? 280 : 'none',
                            }}
                          >
                            <img
                              src={resolveImageUrl(img.image_url)}
                              alt=""
                              style={{
                                maxWidth: '100%',
                                maxHeight: multi ? 240 : 480,
                                width: 'auto',
                                height: 'auto',
                                objectFit: 'contain',
                                cursor: 'pointer',
                                display: 'block',
                                transition: 'opacity 0.2s ease',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Post Actions */}
                  <div style={{ display: 'flex', gap: 16, padding: '12px 20px', borderTop: '1px solid var(--surface-card)' }}>
                    <button
                      onClick={() => handleLike(p.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                        color: p.is_liked ? 'var(--primary)' : 'var(--mute)',
                        fontWeight: 700, fontSize: 13,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Heart size={16} fill={p.is_liked ? 'var(--primary)' : 'none'} />
                      {p.like_count || 0}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--mute)', fontSize: 13, fontWeight: 700 }}>
                      <MessageCircle size={16} />
                      {p.comment_count || 0}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
