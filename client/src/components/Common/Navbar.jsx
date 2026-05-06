import React, { useState, useEffect } from 'react';
import { Search, Bell, MessageCircle, User, ShoppingCart, BookOpen, Calendar, MapPin, Home, Megaphone, Users, Settings, Shield, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveImageUrl, getDefaultAvatar, apiFetch } from '../../config/api';

const Navbar = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const res = await apiFetch('/notifications/unread-count');
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unread_count || 0);
        }
      } catch {}
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const mainTabs = [
    { id: 'feed', label: 'Bảng tin', icon: <Home size={20} /> },
    { id: 'board', label: 'Rao vặt', icon: <Megaphone size={20} /> },
    { id: 'shop', label: 'Cửa hàng', icon: <ShoppingCart size={20} /> },
    { id: 'docs', label: 'Tài liệu', icon: <BookOpen size={20} /> },
    { id: 'timetable', label: 'TKB', icon: <Calendar size={20} /> },
    { id: 'map', label: 'Bản đồ', icon: <MapPin size={20} /> },
  ];

  const avatar = user ? (resolveImageUrl(user.avatar_url) || getDefaultAvatar(user.full_name)) : '';

  return (
    <nav className="navbar">
      <div className="logo" onClick={() => setActiveTab('feed')} style={{ cursor: 'pointer' }}>
        <div style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'rotate(15deg) scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'rotate(0) scale(1)'}
        >T</div>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {mainTabs.map((tab) => (
          <button
            key={tab.id}
            id={`nav-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className="btn-secondary"
            style={{
              backgroundColor: activeTab === tab.id ? 'var(--ink)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--ink)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
              transform: activeTab === tab.id ? 'scale(1)' : 'scale(1)',
              boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {tab.icon}
            <span style={{ fontWeight: 600 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Notifications */}
        <button
          id="nav-notifications"
          onClick={() => setActiveTab('notifications')}
          style={{ background: activeTab === 'notifications' ? 'var(--surface-card)' : 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', padding: 8, borderRadius: '50%', position: 'relative', transition: 'transform 0.2s ease, background 0.2s ease' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Bell size={22} />
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--primary)', color: 'white', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 2s infinite', boxShadow: '0 0 0 2px white' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>

        <button
          id="nav-messages"
          onClick={() => setActiveTab('messaging')}
          style={{ background: activeTab === 'messaging' ? 'var(--surface-card)' : 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', padding: 8, borderRadius: '50%', transition: 'transform 0.2s ease, background 0.2s ease' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageCircle size={22} />
        </button>

        <button
          id="nav-friends"
          onClick={() => setActiveTab('friends')}
          style={{ background: activeTab === 'friends' ? 'var(--surface-card)' : 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', padding: 8, borderRadius: '50%', transition: 'transform 0.2s ease, background 0.2s ease' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Users size={22} />
        </button>

        {/* User Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <img src={avatar} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--surface-card)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </button>

          {showUserMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowUserMenu(false)} />
              <div style={{
                position: 'absolute', top: '120%', right: 0, width: 220,
                background: 'white', borderRadius: 'var(--rounded-md)',
                boxShadow: '0 12px 48px rgba(0,0,0,0.12)', zIndex: 1000,
                border: '1px solid var(--hairline)', overflow: 'hidden',
                animation: 'fadeInDown 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
              }}>
                <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--hairline)' }}>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>{user?.full_name}</p>
                  <p style={{ fontSize: 11, color: 'var(--ash)' }}>{user?.email}</p>
                </div>
                {[
                  { id: 'profile', label: 'Trang cá nhân', icon: <User size={16} /> },
                  { id: 'settings', label: 'Cài đặt', icon: <Settings size={16} /> },
                  ...(user?.role === 'admin' ? [{ id: 'admin', label: 'Quản trị', icon: <Shield size={16} /> }] : []),
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setShowUserMenu(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', fontWeight: 600, fontSize: 13, color: 'var(--body)' }}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid var(--hairline)' }}>
                  <button
                    onClick={() => { logout(); setShowUserMenu(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', fontWeight: 600, fontSize: 13, color: 'var(--primary)' }}
                  >
                    <LogOut size={16} /> Đăng xuất
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
