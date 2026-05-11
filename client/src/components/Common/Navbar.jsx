import { NavLink, Link } from 'react-router-dom';
import { Search, Bell, MessageCircle, ShoppingCart, BookOpen, Calendar, MapPin } from 'lucide-react';

const Navbar = () => {
  const tabs = [
    { id: 'shop', label: 'Cửa hàng', icon: <ShoppingCart size={20} />, path: '/shop' },
    { id: 'docs', label: 'Tài liệu', icon: <BookOpen size={20} />, path: '/docs' },
    { id: 'timetable', label: 'Thời khóa biểu', icon: <Calendar size={20} />, path: '/timetable' },
    { id: 'map', label: 'Bản đồ', icon: <MapPin size={20} />, path: '/map' },
  ];

  return (
    <nav className="navbar">
      <Link to="/" style={{ textDecoration: 'none' }}>
        <div className="logo">
          <div style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>P</div>
        </div>
      </Link>
      
      <div style={{ display: 'flex', gap: 8 }}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.path}
            style={({ isActive }) => ({
              backgroundColor: isActive ? 'var(--ink)' : 'transparent',
              color: isActive ? 'white' : 'var(--ink)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              borderRadius: 'var(--rounded-full)',
              fontWeight: 600,
              fontSize: 16,
              transition: 'all 0.2s'
            })}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </NavLink>
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
