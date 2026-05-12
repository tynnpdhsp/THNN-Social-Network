import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2, UserCheck, UserX, Heart, MessageCircle, UserPlus, Calendar, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../config/api';
import { useConfirm } from '../Common/ConfirmDialog';

const Notifications = ({ onViewProfile, onNavigate }) => {
  const confirm = useConfirm();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifs = useCallback(async () => {
    try {
      const res = await apiFetch('/notifications');
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
      window.dispatchEvent(new Event('refreshNotifs'));
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  const markAsRead = async (id) => {
    try {
      await apiFetch('/notifications/read', { method: 'PUT', body: JSON.stringify({ notification_ids: [id] }) });
    } catch (err) { console.error('Error loading notifications:', err); }
  };

  const markAllRead = async () => {
    await apiFetch('/notifications/read-all', { method: 'PUT' });
    loadNotifs();
    window.dispatchEvent(new Event('refreshNotifs'));
  };

  const deleteNotif = async (e, id) => {
    e.stopPropagation();
    await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
    loadNotifs();
    window.dispatchEvent(new Event('refreshNotifs'));
  };

  const deleteAll = async () => {
    const ok = await confirm({
      title: 'Xóa tất cả thông báo',
      message: 'Tất cả thông báo sẽ bị xóa vĩnh viễn. Bạn có chắc chắn?',
      confirmText: 'Xóa tất cả',
      cancelText: 'Hủy',
      variant: 'danger',
      icon: 'delete',
    });
    if (!ok) return;
    await apiFetch('/notifications', { method: 'DELETE' });
    toast.success('Đã xóa tất cả thông báo');
    loadNotifs();
  };

  const acceptFriend = async (e, refId, notifId) => {
    e.stopPropagation();
    await apiFetch(`/social/friends/requests/${refId}/accept`, { method: 'POST' });
    if (notifId) await apiFetch(`/notifications/${notifId}`, { method: 'DELETE' });
    loadNotifs();
  };

  const rejectFriend = async (e, refId, notifId) => {
    e.stopPropagation();
    await apiFetch(`/social/friends/requests/${refId}/reject`, { method: 'POST' });
    if (notifId) await apiFetch(`/notifications/${notifId}`, { method: 'DELETE' });
    loadNotifs();
  };

  const handleNotifClick = async (n) => {
    // Đánh dấu đã đọc
    if (!n.is_read) {
      await markAsRead(n.id);
      loadNotifs(); // Cập nhật lại danh sách và số lượng chưa đọc
    }
    
    const refId = n.metadata?.reference_id;
    const refType = n.metadata?.reference_type;

    if (!refId) return;

    switch (refType) {
      case 'post':
        // Like, comment, reply → đi đến bài viết (về feed)
        onNavigate?.('feed', { scrollToPost: refId });
        break;
      case 'user':
        // Friend request → xem profile người gửi
        onViewProfile?.(refId);
        break;
      default:
        break;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'like': return <Heart size={14} color="var(--primary)" fill="var(--primary)" />;
      case 'comment': return <MessageCircle size={14} color="var(--focus-outer)" />;
      case 'reply': return <MessageCircle size={14} color="#8b5cf6" />;
      case 'friend_request': return <UserPlus size={14} color="#16a34a" />;
      case 'schedule': return <Calendar size={14} color="#8b5cf6" />;
      case 'system': return <AlertCircle size={14} color="#f59e0b" />;
      default: return <Bell size={14} color="var(--ash)" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'like': return 'Lượt thích';
      case 'comment': return 'Bình luận';
      case 'reply': return 'Phản hồi';
      case 'friend_request': return 'Kết bạn';
      case 'schedule': return 'Lịch trình';
      case 'system': return 'Hệ thống';
      default: return type?.replace('_', ' ') || 'Khác';
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
              onClick={() => handleNotifClick(n)}
              style={{
                background: 'white',
                borderRadius: 'var(--rounded-md)',
                padding: '16px 20px',
                border: '1px solid var(--hairline)',
                borderLeft: n.is_read ? '3px solid transparent' : '3px solid var(--primary)',
                opacity: n.is_read ? 0.7 : 1,
                cursor: n.metadata?.reference_id ? 'pointer' : 'default',
                transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                animation: `fadeInUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 0.06}s both`,
              }}
              onMouseEnter={(e) => { if (n.metadata?.reference_id) { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; }}}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span>{getTypeIcon(n.type)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {getTypeLabel(n.type)}
                    </span>
                    {n.metadata?.reference_id && (
                      <span style={{ fontSize: 10, color: 'var(--ash)', fontWeight: 600 }}>• Nhấn để xem</span>
                    )}
                  </div>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{n.title}</p>
                  <p style={{ fontSize: 13, color: 'var(--mute)' }}>{n.content}</p>

                  {/* Friend Request Actions */}
                  {n.type === 'friend_request' && n.metadata?.reference_id && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={(e) => acceptFriend(e, n.metadata.reference_id, n.id)} className="btn-primary" style={{ padding: '6px 16px', fontSize: 12, gap: 6, display: 'flex', alignItems: 'center' }}>
                        <UserCheck size={14} /> Chấp nhận
                      </button>
                      <button onClick={(e) => rejectFriend(e, n.metadata.reference_id, n.id)} className="btn-secondary" style={{ padding: '6px 16px', fontSize: 12, gap: 6, display: 'flex', alignItems: 'center' }}>
                        <UserX size={14} /> Từ chối
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--ash)', fontWeight: 600 }}>
                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button onClick={(e) => deleteNotif(e, n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ash)', padding: 2 }}>
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
