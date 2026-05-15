import React, { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, UserCheck, UserX, Flag, Ban, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, resolveImageUrl, getDefaultAvatar } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../Common/ConfirmDialog';

const Friends = ({ onViewProfile, onStartChat }) => {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [reqRes, frRes] = await Promise.all([
        apiFetch('/social/friends/requests'),
        apiFetch('/social/friends'),
      ]);
      setRequests(await reqRes.json());
      setFriends(await frRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await apiFetch(`/account/search?query=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.filter(u => u.id !== user?.id));
    } catch { setSearchResults([]); }
  };

  const sendRequest = async (id) => {
    await apiFetch(`/social/friends/requests/${id}`, { method: 'POST' });
    handleSearch();
  };

  const acceptRequest = async (id) => {
    await apiFetch(`/social/friends/requests/${id}/accept`, { method: 'POST' });
    loadData();
  };

  const rejectRequest = async (id) => {
    await apiFetch(`/social/friends/requests/${id}/reject`, { method: 'POST' });
    loadData();
  };

  const unfriend = async (id) => {
    const ok = await confirm({
      title: 'Hủy kết bạn',
      message: 'Bạn có chắc chắn muốn hủy kết bạn với người này?',
      confirmText: 'Hủy kết bạn',
      cancelText: 'Giữ lại',
      variant: 'danger',
      icon: 'unfriend',
    });
    if (!ok) return;
    await apiFetch(`/social/friends/${id}`, { method: 'DELETE' });
    toast.success('Đã hủy kết bạn');
    loadData();
  };

  const blockUser = async (id) => {
    const ok = await confirm({
      title: 'Chặn người dùng',
      message: 'Người dùng này sẽ không thể xem bài viết hay liên hệ với bạn. Bạn có chắc chắn?',
      confirmText: 'Chặn',
      cancelText: 'Hủy',
      variant: 'danger',
      icon: 'block',
    });
    if (!ok) return;
    await apiFetch(`/social/blocks/${id}`, { method: 'POST' });
    toast.success('Đã chặn người dùng');
    loadData();
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div style={{ width: 32, height: 32, border: '3px solid var(--hairline)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      {/* Search */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Khám phá bạn bè</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div className="search-container" style={{ flex: 1 }}>
            <Search size={18} />
            <input
              id="friends-search"
              type="text"
              placeholder="Tìm kiếm theo tên..."
              className="input-field search-bar"
              style={{ height: 44 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button className="btn-primary" style={{ padding: '0 24px', fontSize: 14 }} onClick={handleSearch}>Tìm</button>
        </div>

        {searchResults.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {searchResults.map(u => {
              const av = resolveImageUrl(u.avatar_url) || getDefaultAvatar(u.full_name);
              return (
                <div key={u.id} style={s.userCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img 
                      src={av} 
                      alt="" 
                      style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => onViewProfile?.(u.id)}
                    />
                    <div>
                      <p 
                        style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                        onClick={() => onViewProfile?.(u.id)}
                      >{u.full_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--ash)' }}>#{u.id?.substring(0, 6)}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    {u.friend_status === 'none' && (
                      <button onClick={() => sendRequest(u.id)} style={s.actionBtn}><UserPlus size={14} /> Kết bạn</button>
                    )}
                    {u.friend_status === 'pending' && (
                      <button style={{ ...s.actionBtn, opacity: 0.7 }} disabled>Đã gửi yêu cầu</button>
                    )}
                    {u.friend_status === 'pending_received' && (
                      <button onClick={() => acceptRequest(u.id)} style={{ ...s.actionBtn, background: 'var(--primary)', color: 'white' }}><UserCheck size={14} /> Chấp nhận</button>
                    )}
                    {u.friend_status === 'accepted' && (
                      <button onClick={() => onStartChat?.(u)} style={{ ...s.actionBtn, background: 'var(--primary)', color: 'white' }}><MessageSquare size={14} /> Nhắn tin</button>
                    )}
                    {u.friend_status !== 'me' && (
                      <button onClick={() => blockUser(u.id)} style={{ ...s.actionBtn, color: 'var(--primary)', background: '#fef2f2' }}><Ban size={14} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Requests & Friends */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Pending Requests */}
        <div style={s.section}>
          <h3 style={{ ...s.sectionTitle, color: 'var(--primary)' }}>Lời mời kết bạn ({requests.length})</h3>
          {requests.length === 0 ? (
            <p style={s.empty}>Không có lời mời nào</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {requests.map(r => (
                <div key={r.from_id} style={s.requestCard}>
                  <span 
                    style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                    onClick={() => onViewProfile?.(r.from_id)}
                  >{r.full_name}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => acceptRequest(r.from_id)} style={{ ...s.smallBtn, background: 'var(--primary)', color: 'white' }}>
                      <UserCheck size={14} /> Nhận
                    </button>
                    <button onClick={() => rejectRequest(r.from_id)} style={s.smallBtn}>
                      <UserX size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Friends List */}
        <div style={s.section}>
          <h3 style={{ ...s.sectionTitle, color: 'var(--focus-outer)' }}>Danh sách bạn bè ({friends.length})</h3>
          {friends.length === 0 ? (
            <p style={s.empty}>Chưa có bạn bè</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {friends.map(f => (
                <div key={f.id} style={s.requestCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img 
                      src={resolveImageUrl(f.avatar_url) || getDefaultAvatar(f.full_name)} 
                      alt="" 
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }} 
                      onClick={() => onViewProfile?.(f.id)}
                    />
                    <span 
                      style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                      onClick={() => onViewProfile?.(f.id)}
                    >{f.full_name}</span>
                  </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => onStartChat?.(f)} style={{ ...s.smallBtn, background: 'var(--surface-card)', color: 'var(--primary)' }}>
                        <MessageSquare size={14} />
                      </button>
                      <button onClick={() => unfriend(f.id)} style={{ ...s.smallBtn, color: 'var(--mute)' }}>Hủy bạn</button>
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const s = {
  section: {
    background: 'white',
    borderRadius: 'var(--rounded-lg)',
    padding: 24,
    border: '1px solid var(--hairline)',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 16,
  },
  userCard: {
    background: 'var(--surface-soft)',
    borderRadius: 'var(--rounded-md)',
    padding: 16,
    border: '1px solid var(--hairline)',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 'var(--rounded-full)',
    border: 'none',
    background: 'var(--surface-card)',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
    color: 'var(--body)',
  },
  requestCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--surface-soft)',
    padding: '12px 16px',
    borderRadius: 'var(--rounded-md)',
  },
  smallBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 'var(--rounded-full)',
    border: 'none',
    background: 'var(--surface-card)',
    fontWeight: 700,
    fontSize: 11,
    cursor: 'pointer',
    color: 'var(--body)',
  },
  empty: {
    fontSize: 13,
    color: 'var(--ash)',
    textAlign: 'center',
    padding: 24,
  },
};

export default Friends;
