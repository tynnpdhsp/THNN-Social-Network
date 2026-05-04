import React from 'react';
import { Search, Bell, MessageCircle, User, ShoppingCart, BookOpen, Calendar, MapPin } from 'lucide-react';

const Navbar = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'shop', label: 'Cửa hàng', icon: <ShoppingCart size={20} /> },
    { id: 'docs', label: 'Tài liệu', icon: <BookOpen size={20} /> },
    { id: 'timetable', label: 'Thời khóa biểu', icon: <Calendar size={20} /> },
    { id: 'map', label: 'Bản đồ', icon: <MapPin size={20} /> },
  ];

  return (
    <nav className="navbar">
      <div className="logo">
        <div style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyCenter: 'center', fontSize: 20 }}>P</div>
      </div>
      
      <div style={{ display: 'flex', gap: 8 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="btn-secondary"
            style={{
              backgroundColor: activeTab === tab.id ? 'var(--ink)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--ink)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {tab.icon}
            <span style={{ fontWeight: 600 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="search-container" style={{ flex: 1 }}>
        <Search size={20} />
        <input 
          type="text" 
          placeholder="Tìm kiếm ý tưởng, tài liệu..." 
          className="input-field search-bar"
        />
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <button className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}><Bell size={24} /></button>
        <button className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}><MessageCircle size={24} /></button>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eee', overflow: 'hidden' }}>
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="avatar" />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
