import { Toaster } from 'react-hot-toast';
import { ConfirmProvider } from './components/Common/ConfirmDialog';
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
  const [activeTab, setActiveTab] = React.useState(() => {
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['feed', 'board', 'profile', 'friends', 'messaging', 'notifications', 'settings', 'admin', 'shop', 'docs', 'timetable', 'map'];
    return validTabs.includes(hash) ? hash : 'feed';
  });
  const [viewingUserId, setViewingUserId] = useState(null);
  const [chatTarget, setChatTarget] = useState(null);
  const [focusPostId, setFocusPostId] = useState(null);

  const updateUrlHash = (tab) => {
    if (tab === 'feed') {
      window.history.pushState('', document.title, window.location.pathname + window.location.search);
    } else {
      window.location.hash = tab;
    }
  };

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['feed', 'board', 'profile', 'friends', 'messaging', 'notifications', 'settings', 'admin', 'shop', 'docs', 'timetable', 'map'];
      if (hash === '' || hash === 'feed') {
        setActiveTab('feed');
      } else if (validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
    updateUrlHash(tab);
  };

  const onViewProfile = (userId) => {
    setViewingUserId(userId);
    setActiveTab('profile');
    updateUrlHash('profile');
  };

  const onStartChat = (targetUser) => {
    setChatTarget(targetUser);
    setActiveTab('messaging');
    updateUrlHash('messaging');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'feed': return <Feed onViewProfile={onViewProfile} focusPostId={focusPostId} onPostFocused={() => setFocusPostId(null)} />;
      case 'board': return <Board onViewProfile={onViewProfile} />;
      case 'profile': return <Profile targetUserId={viewingUserId} onStartChat={onStartChat} />;
      case 'friends': return <Friends onViewProfile={onViewProfile} onStartChat={onStartChat} />;
      case 'messaging': return <Messaging onViewProfile={onViewProfile} preselectedUser={chatTarget} />;
      case 'notifications': return <Notifications onViewProfile={onViewProfile} onNavigate={(tab, ctx) => { if (ctx?.scrollToPost) setFocusPostId(ctx.scrollToPost); handleSetTab(tab); }} />;
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
    <ConfirmProvider>
    <div className="App">
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          duration: 3500,
          style: {
            background: 'white',
            color: 'var(--ink)',
            fontWeight: 600,
            fontSize: 14,
            borderRadius: 14,
            padding: '14px 20px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
            fontFamily: 'var(--font-family)',
            maxWidth: 420,
          },
          success: {
            iconTheme: { primary: '#16a34a', secondary: '#f0fdf4' },
            style: { borderLeft: '4px solid #16a34a' },
          },
          error: {
            iconTheme: { primary: '#dc2626', secondary: '#fef2f2' },
            style: { borderLeft: '4px solid #dc2626' },
          },
          loading: {
            iconTheme: { primary: 'var(--primary)', secondary: '#fef2f2' },
            style: { borderLeft: '4px solid var(--primary)' },
          },
        }}
      />
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
    </ConfirmProvider>
  );
}

export default App;
