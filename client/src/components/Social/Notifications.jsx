import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2, UserCheck, UserX, Heart, MessageCircle, UserPlus, Mail } from 'lucide-react';
import { apiFetch } from '../../config/api';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifs = useCallback(async () => {
    try {
      const res = await apiFetch('/notifications');
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  const markAllRead = async () => {
    await apiFetch('/notifications/read-all', { method: 'PUT' });
    loadNotifs();
  };

  const deleteNotif = async (id) => {
    await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
    loadNotifs();
  };

  const deleteAll = async () => {
    if (!confirm('Xóa tất cả thông báo?')) return;
    await apiFetch('/notifications', { method: 'DELETE' });
    loadNotifs();
  };

  const acceptFriend = async (refId, notifId) => {
    await apiFetch(`/social/friends/requests/${refId}/accept`, { method: 'POST' });
    if (notifId) await apiFetch(`/notifications/${notifId}`, { method: 'DELETE' });
    loadNotifs();
  };

  const rejectFriend = async (refId, notifId) => {
    await apiFetch(`/social/friends/requests/${refId}/reject`, { method: 'POST' });
    if (notifId) await apiFetch(`/notifications/${notifId}`, { method: 'DELETE' });
    loadNotifs();
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'like': return <Heart size={14} color="var(--primary)" fill="var(--primary)" />;
      case 'comment': return <MessageCircle size={14} color="var(--focus-outer)" />;
      case 'friend_request': return <UserPlus size={14} color="#16a34a" />;
      case 'message': return <Mail size={14} color="#f59e0b" />;
      default: return <Bell size={14} color="var(--ash)" />;
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div style={{ width: 32, height: 32, border: '3px solid var(--hairline)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontWeight: 700, fontSize: 20 }}>Thông báo</h2>
          {unreadCount > 0 && (
            <span style={{
              background: 'var(--primary)',
              color: 'white',
              padding: '2px 10px',
              borderRadius: 'var(--rounded-full)',
              fontSize: 12,
              fontWeight: 700,
              animation: 'popIn 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
            }}>{unreadCount}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={markAllRead} className="btn-secondary" style={{ fontSize: 12, padding: '8px 16px', gap: 6, display: 'flex', alignItems: 'center' }}>
            <CheckCheck size={14} /> Đọc tất cả
          </button>
          <button onClick={deleteAll} className="btn-secondary" style={{ fontSize: 12, padding: '8px 16px', gap: 6, display: 'flex', alignItems: 'center', color: 'var(--primary)' }}>
            <Trash2 size={14} /> Xóa tất cả
          </button>
        </div>
      </div>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--ash)', background: 'var(--surface-soft)', borderRadius: 'var(--rounded-lg)', border: '1px dashed var(--hairline)', animation: 'fadeIn 0.5s ease' }}>
          <Bell size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p style={{ fontWeight: 700 }}>Không có thông báo</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifications.map((n, idx) => (
            <div
              key={n.id}
              style={{
                background: 'white',
                borderRadius: 'var(--rounded-md)',
                padding: '16px 20px',
                border: '1px solid var(--hairline)',
                borderLeft: n.is_read ? '3px solid transparent' : '3px solid var(--primary)',
                opacity: n.is_read ? 0.7 : 1,
                transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                animation: `fadeInUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 0.06}s both`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span>{getTypeIcon(n.type)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {n.type?.replace('_', ' ')}
                    </span>
                  </div>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{n.title}</p>
                  <p style={{ fontSize: 13, color: 'var(--mute)' }}>{n.content}</p>

                  {/* Friend Request Actions */}
                  {n.type === 'friend_request' && n.metadata?.reference_id && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={() => acceptFriend(n.metadata.reference_id, n.id)} className="btn-primary" style={{ padding: '6px 16px', fontSize: 12, gap: 6, display: 'flex', alignItems: 'center' }}>
                        <UserCheck size={14} /> Chấp nhận
                      </button>
                      <button onClick={() => rejectFriend(n.metadata.reference_id, n.id)} className="btn-secondary" style={{ padding: '6px 16px', fontSize: 12, gap: 6, display: 'flex', alignItems: 'center' }}>
                        <UserX size={14} /> Từ chối
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--ash)', fontWeight: 600 }}>
                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button onClick={() => deleteNotif(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ash)', padding: 2 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
