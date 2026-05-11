import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Common/Navbar';
import Shop from './components/Shop/Shop';
import StudyDocs from './components/StudyDocs/StudyDocs';
import Timetable from './components/Timetable/Timetable';
import Map from './components/Map/Map';

function App() {
  const [activeTab, setActiveTab] = useState('shop');

  const renderContent = () => {
    switch (activeTab) {
      case 'shop':
        return <Shop />;
      case 'docs':
        return <StudyDocs />;
      case 'timetable':
        return <Timetable />;
      case 'map':
        return <Map />;
      default:
        return <Shop />;
    }
  };

  return (
    <div className="App">
      <Toaster position="top-right" reverseOrder={false} />
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main style={{ minHeight: 'calc(100vh - 80px)', background: 'var(--canvas)' }}>
        {renderContent()}
      </main>
      
    </div>
  );
}

export default App;
