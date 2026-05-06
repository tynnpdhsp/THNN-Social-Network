import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import AuthPage from './components/Auth/AuthPage';
import Navbar from './components/Common/Navbar';
import Feed from './components/Social/Feed';
import Board from './components/Social/Board';
import Profile from './components/Social/Profile';
import Friends from './components/Social/Friends';
import Messaging from './components/Social/Messaging';
import Notifications from './components/Social/Notifications';
import Settings from './components/Social/Settings';
import AdminPanel from './components/Social/AdminPanel';
import Shop from './components/Shop/Shop';
import StudyDocs from './components/StudyDocs/StudyDocs';
import Timetable from './components/Timetable/Timetable';
import Map from './components/Map/Map';

function App() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('feed');

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--canvas)',
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid var(--hairline)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  // Not logged in → show auth page
  if (!user) {
    return <AuthPage />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'feed': return <Feed />;
      case 'board': return <Board />;
      case 'profile': return <Profile />;
      case 'friends': return <Friends />;
      case 'messaging': return <Messaging />;
      case 'notifications': return <Notifications />;
      case 'settings': return <Settings />;
      case 'admin': return <AdminPanel />;
      case 'shop': return <Shop />;
      case 'docs': return <StudyDocs />;
      case 'timetable': return <Timetable />;
      case 'map': return <Map />;
      default: return <Feed />;
    }
  };

  return (
    <div className="App">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main style={{ minHeight: 'calc(100vh - 80px)', background: 'var(--canvas)' }}>
        {/* Page transition: key change triggers re-mount → CSS animation fires */}
        <div
          key={activeTab}
          style={{
            animation: 'fadeInUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
