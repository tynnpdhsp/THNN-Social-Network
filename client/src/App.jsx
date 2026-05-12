import { Toaster } from 'react-hot-toast';
import { Routes, Route, Navigate } from 'react-router-dom';
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
  return (
    <div className="App">
      <Toaster position="top-right" reverseOrder={false} />
      <Navbar />
      <main style={{ minHeight: 'calc(100vh - 80px)', background: 'var(--canvas)' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/shop" replace />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/docs" element={<StudyDocs />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/map" element={<Map />} />
        </Routes>
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('feed');
  const [viewingUserId, setViewingUserId] = useState(null);
  const [chatTarget, setChatTarget] = useState(null);
  const [focusPostId, setFocusPostId] = useState(null);

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

  const handleSetTab = (tab) => {
    if (tab === 'profile') setViewingUserId(null);
    if (tab !== 'messaging') setChatTarget(null);
    if (tab !== 'feed') setFocusPostId(null);
    setActiveTab(tab);
  };

  const onViewProfile = (userId) => {
    setViewingUserId(userId);
    setActiveTab('profile');
  };

  const onStartChat = (targetUser) => {
    setChatTarget(targetUser);
    setActiveTab('messaging');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'feed': return <Feed onViewProfile={onViewProfile} focusPostId={focusPostId} onPostFocused={() => setFocusPostId(null)} />;
      case 'board': return <Board onViewProfile={onViewProfile} />;
      case 'profile': return <Profile targetUserId={viewingUserId} onStartChat={onStartChat} />;
      case 'friends': return <Friends onViewProfile={onViewProfile} />;
      case 'messaging': return <Messaging onViewProfile={onViewProfile} preselectedUser={chatTarget} />;
      case 'notifications': return <Notifications onViewProfile={onViewProfile} onNavigate={(tab, ctx) => { if (ctx?.scrollToPost) setFocusPostId(ctx.scrollToPost); setActiveTab(tab); }} />;
      case 'settings': return <Settings />;
      case 'admin': return <AdminPanel onViewProfile={onViewProfile} />;
      case 'shop': return <Shop />;
      case 'docs': return <StudyDocs />;
      case 'timetable': return <Timetable />;
      case 'map': return <Map />;
      default: return <Feed onViewProfile={onViewProfile} />;
    }
  };

  return (
    <div className="App">
      <Navbar activeTab={activeTab} setActiveTab={handleSetTab} />
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
