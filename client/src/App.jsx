import { Toaster } from 'react-hot-toast';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Common/Navbar';
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
      </main>
    </div>
  );
}

export default App;
