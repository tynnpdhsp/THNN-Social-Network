import React, { useState } from 'react';
import { Calendar, Clock, Plus, Check, Save, Download, Sparkles, AlertCircle, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from '../Common/Modal';
import AIModal from './AIModal';
import ImportModal from './ImportModal';

const timeSlots = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

const initialDeadlines = [
  { id: 1, title: 'Báo cáo Kinh tế chính trị', subject: 'Kinh tế học', time: '2026-05-10T23:59', description: 'Nộp file PDF qua LMS', reminder: '60' },
  { id: 2, title: 'Kiểm tra Giữa kỳ Toán rời rạc', subject: 'Toán học', time: '2026-05-15T09:00', description: 'Phòng 402 nhà C', reminder: '1440' },
];

const initialSchedules = {
  plan1: [
    { id: 1, day: 0, start: '08:00', end: '11:00', title: 'Lập trình Python', room: 'Lab 201', instructor: 'Thầy Bình' },
    { id: 2, day: 2, start: '13:00', end: '16:00', title: 'Cấu trúc dữ liệu', room: 'P.302', instructor: 'Cô Mai' },
  ],
  plan2: [
    { id: 3, day: 1, start: '09:00', end: '12:00', title: 'Tiếng Anh chuyên ngành', room: 'P.105', instructor: 'Ms. Alice' },
  ],
  planAI: [
    { id: 4, day: 0, start: '08:00', end: '10:00', title: '✨ AI Optimized Class', room: 'P.501', instructor: 'AI System' },
    { id: 5, day: 1, start: '08:00', end: '10:00', title: '✨ AI Optimized Class', room: 'P.501', instructor: 'AI System' },
  ]
};

const Timetable = () => {
  const [activePlan, setActivePlan] = useState('plan1');
  const [deadlines, setDeadlines] = useState(initialDeadlines);
  const [schedules] = useState(initialSchedules);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [newDeadline, setNewDeadline] = useState({ title: '', subject: '', time: '', description: '', reminder: '30' });
  const [isSaved, setIsSaved] = useState(false);

  const handleAddDeadline = () => {
    if (newDeadline.title && newDeadline.time) {
      setDeadlines([...deadlines, { ...newDeadline, id: Date.now() }]);
      setShowDeadlineModal(false);
      setNewDeadline({ title: '', subject: '', time: '', description: '', reminder: '30' });
    }
  };

  const handleDeleteDeadline = (id) => {
    setDeadlines(deadlines.filter(d => d.id !== id));
  };

  return (
    <div className="container" style={{ paddingTop: 24, display: 'flex', gap: 32 }}>
      {/* Left: Main Timetable Content */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <h1 className="heading-xl">Quản lý Thời khóa biểu</h1>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button onClick={() => setShowImportModal(true)} className="btn-secondary" style={{ gap: 8, fontSize: 13 }}><Download size={16} /> Import</button>
              <button onClick={() => setShowAIModal(true)} className="btn-primary" style={{ gap: 8, fontSize: 13, background: 'var(--ink)' }}><Sparkles size={16} /> AI Gợi ý lịch</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ display: 'flex', background: 'var(--surface-card)', borderRadius: 'var(--rounded-full)', padding: 4 }}>
              {['plan1', 'plan2', 'planAI'].map((plan, i) => (
                <button
                  key={plan}
                  onClick={() => setActivePlan(plan)}
                  style={{
                    padding: '8px 16px', border: 'none',
                    background: activePlan === plan ? 'white' : 'transparent',
                    borderRadius: 'var(--rounded-full)',
                    fontWeight: activePlan === plan ? 700 : 500,
                    boxShadow: activePlan === plan ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer', fontSize: 13
                  }}
                >
                  {plan === 'planAI' ? '✨ AI Plan' : `Phương án ${i + 1}`}
                </button>
              ))}
            </div>
            <button
              className="btn-primary"
              style={{ gap: 8, width: '100%', background: isSaved ? '#103c25' : 'var(--primary)' }}
              onClick={() => { setIsSaved(true); setTimeout(() => setIsSaved(false), 3000); }}
            >
              {isSaved ? <Check size={18} /> : <Save size={18} />}
              {isSaved ? 'Đã lưu vào lịch cá nhân' : 'Lưu phương án này'}
            </button>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', borderBottom: '1px solid var(--hairline)' }}>
            <div style={{ padding: 12, borderRight: '1px solid var(--hairline)' }}></div>
            {days.map(day => (
              <div key={day} style={{ padding: 12, textAlign: 'center', fontWeight: 700, borderRight: '1px solid var(--hairline)', background: 'var(--surface-soft)' }}>{day}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {timeSlots.map(time => (
                <div key={time} style={{ height: 80, padding: 8, borderBottom: '1px solid var(--hairline)', borderRight: '1px solid var(--hairline)', fontSize: 12, color: 'var(--mute)' }}>{time}</div>
              ))}
            </div>

            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ position: 'relative', borderRight: '1px solid var(--hairline)' }}>
                {timeSlots.map(time => (
                  <div key={time} style={{ height: 80, borderBottom: '1px dotted var(--hairline)' }}></div>
                ))}

                {schedules[activePlan].filter(e => e.day === i).map(event => {
                  const startIndex = timeSlots.indexOf(event.start);
                  const endIndex = timeSlots.indexOf(event.end);
                  const height = (endIndex - startIndex) * 80;
                  const top = startIndex * 80;

                  return (
                    <div key={event.id} style={{
                      position: 'absolute', top: top + 4, left: 4, right: 4, height: height - 8,
                      background: activePlan === 'planAI' ? 'linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)' : '#e0f2fe',
                      borderRadius: 8, padding: 12, fontSize: 12, border: '1px solid rgba(0,0,0,0.05)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)', zIndex: 10
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{event.title}</div>
                      <div style={{ opacity: 0.7 }}>{event.room} • {event.instructor}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Sidebar for Deadlines */}
      <div style={{ width: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 className="heading-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={20} color="var(--primary)" /> Hạn nộp & Lịch thi
          </h2>
          <button 
            className="btn-primary" 
            style={{ width: 36, height: 36, padding: 0, borderRadius: '50%' }}
            onClick={() => setShowDeadlineModal(true)}
          >
            <Plus size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {deadlines.map(d => (
            <div key={d.id} style={{
              padding: 16, background: 'white', borderRadius: 'var(--rounded-md)',
              border: '1px solid var(--hairline)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="caption-sm" style={{ fontWeight: 700, color: 'var(--primary)' }}>{d.subject}</span>
                <button onClick={() => handleDeleteDeadline(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ash)' }}><Trash2 size={16} /></button>
              </div>
              <h4 className="body-strong" style={{ marginBottom: 4 }}>{d.title}</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--mute)' }}>
                <Clock size={14} /> {new Date(d.time).toLocaleString('vi-VN')}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AIModal 
        isOpen={showAIModal} 
        onClose={() => setShowAIModal(false)} 
        onOptimize={() => { setActivePlan('planAI'); setShowAIModal(false); }} 
      />

      <ImportModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
      />

      <Modal isOpen={showDeadlineModal} onClose={() => setShowDeadlineModal(false)} title="Thêm ghi chú mới" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Tiêu đề</label>
            <input type="text" className="input-field" placeholder="Tên sự kiện..." value={newDeadline.title} onChange={e => setNewDeadline({...newDeadline, title: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Môn học</label>
            <input type="text" className="input-field" placeholder="Môn học liên quan..." value={newDeadline.subject} onChange={e => setNewDeadline({...newDeadline, subject: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Thời gian</label>
            <input type="datetime-local" className="input-field" value={newDeadline.time} onChange={e => setNewDeadline({...newDeadline, time: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Nhắc trước (phút)</label>
            <select className="input-field" value={newDeadline.reminder} onChange={e => setNewDeadline({...newDeadline, reminder: e.target.value})}>
              <option value="15">15 phút</option>
              <option value="30">30 phút</option>
              <option value="60">60 phút</option>
              <option value="1440">1 ngày</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Mô tả</label>
            <textarea className="input-field" placeholder="Ghi chú thêm..." style={{ height: 80, resize: 'none', padding: '12px 20px' }} value={newDeadline.description} onChange={e => setNewDeadline({...newDeadline, description: e.target.value})} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowDeadlineModal(false)}>Hủy</button>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleAddDeadline}>Lưu lại</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Timetable;
