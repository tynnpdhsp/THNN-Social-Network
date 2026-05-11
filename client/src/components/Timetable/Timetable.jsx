import React, { useState, useEffect } from 'react';
import { Clock, Plus, Check, Save, AlertCircle, Trash2, Loader2, ChevronDown, Info, Calendar } from 'lucide-react';
import Modal from '../Common/Modal';
import * as scheduleService from '../../services/scheduleService';

const timeSlots = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

const Timetable = () => {
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [currentEntries, setCurrentEntries] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [newDeadline, setNewDeadline] = useState({ title: '', subject: '', date: '', time: '08:00', description: '', remind_before_minutes: '30' });
  const [newScheduleName, setNewScheduleName] = useState('');
  const [newEntry, setNewEntry] = useState({ title: '', room: '', day_of_week: 1, start_time: '07:00', end_time: '08:00', entry_type: 'custom' });
  const [editingEntry, setEditingEntry] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [isStartTimeOpen, setIsStartTimeOpen] = useState(false);
  const [isEndTimeOpen, setIsEndTimeOpen] = useState(false);
  const [isDeadlineTimeOpen, setIsDeadlineTimeOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const dateInputRef = React.useRef(null);

  useEffect(() => {
    fetchInitialData();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [schedulesData, notesData] = await Promise.all([
        scheduleService.getSchedules(),
        scheduleService.getStudyNotes()
      ]);
      
      setSchedules(schedulesData.items);
      setDeadlines(notesData.items);

      const active = schedulesData.items.find(s => s.is_active) || schedulesData.items[0];
      if (active) {
        setActiveScheduleId(active.id);
        fetchEntries(active.id);
      } else {
        setActiveScheduleId(null);
        setCurrentEntries([]);
      }
    } catch (error) {
      console.error('Error loading timetable data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEntries = async (scheduleId) => {
    try {
      const entries = await scheduleService.getScheduleEntries(scheduleId);
      setCurrentEntries(entries);
    } catch (error) {
      console.error('Error fetching entries:', error);
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phương án này?')) return;
    try {
      await scheduleService.deleteSchedule(id);
      const updatedSchedules = schedules.filter(s => s.id !== id);
      setSchedules(updatedSchedules);
      if (activeScheduleId === id) {
        const next = updatedSchedules[0];
        if (next) {
          setActiveScheduleId(next.id);
          fetchEntries(next.id);
        } else {
          setActiveScheduleId(null);
          setCurrentEntries([]);
        }
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  const handleGridClick = (dayIndex, time) => {
    const endIdx = timeSlots.indexOf(time) + 1;
    const endTime = timeSlots[endIdx] || '18:00';
    setEditingEntry(null);
    setNewEntry({
      title: '',
      room: '',
      day_of_week: dayIndex + 1,
      start_time: time,
      end_time: endTime,
      entry_type: 'custom'
    });
    setShowEntryModal(true);
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setNewEntry({
      title: entry.title,
      room: entry.room || '',
      day_of_week: entry.day_of_week,
      start_time: entry.start_time.substring(0, 5),
      end_time: entry.end_time.substring(0, 5),
      entry_type: entry.entry_type
    });
    setShowEntryModal(true);
  };

  const handleAddEntry = async () => {
    if (!activeScheduleId || !newEntry.title) return;
    try {
      if (editingEntry) {
        const updated = await scheduleService.updateScheduleEntry(activeScheduleId, editingEntry.id, {
          ...newEntry,
          day_of_week: parseInt(newEntry.day_of_week)
        });
        setCurrentEntries(currentEntries.map(e => e.id === editingEntry.id ? updated : e));
      } else {
        const created = await scheduleService.createScheduleEntry(activeScheduleId, {
          ...newEntry,
          day_of_week: parseInt(newEntry.day_of_week)
        });
        setCurrentEntries([...currentEntries, created]);
      }
      setShowEntryModal(false);
      setEditingEntry(null);
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  };

  const handleDeleteEntry = async () => {
    if (!editingEntry || !activeScheduleId) return;
    try {
      await scheduleService.deleteScheduleEntry(activeScheduleId, editingEntry.id);
      setCurrentEntries(currentEntries.filter(e => e.id !== editingEntry.id));
      setShowEntryModal(false);
      setEditingEntry(null);
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const handleSwitchSchedule = (id) => {
    setActiveScheduleId(id);
    fetchEntries(id);
  };

  const handleAddSchedule = async () => {
    if (!newScheduleName.trim()) return;
    try {
      const created = await scheduleService.createSchedule({
        name: newScheduleName,
        source: 'manual'
      });
      setSchedules([...schedules, created]);
      setActiveScheduleId(created.id);
      setCurrentEntries([]);
      setShowScheduleModal(false);
      setNewScheduleName('');
    } catch (error) {
      console.error('Error creating schedule:', error);
    }
  };

  const handleSetActive = async () => {
    if (!activeScheduleId) return;
    try {
      await scheduleService.setActiveSchedule(activeScheduleId);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
      const schedulesData = await scheduleService.getSchedules();
      setSchedules(schedulesData.items);
    } catch (error) {
      console.error('Error setting active schedule:', error);
    }
  };

  const handleAddDeadline = async () => {
    if (newDeadline.title && newDeadline.date && newDeadline.time) {
      try {
        const dueAt = `${newDeadline.date}T${newDeadline.time}:00`;
        const created = await scheduleService.createStudyNote({
          ...newDeadline,
          due_at: new Date(dueAt).toISOString(),
          remind_before_minutes: parseInt(newDeadline.remind_before_minutes)
        });
        setDeadlines([created, ...deadlines]);
        setShowDeadlineModal(false);
        setNewDeadline({ title: '', subject: '', date: '', time: '08:00', description: '', remind_before_minutes: '30' });
      } catch (error) {
        console.error('Error adding deadline:', error);
      }
    }
  };

  const handleDeleteDeadline = async (id) => {
    try {
      await scheduleService.deleteStudyNote(id);
      setDeadlines(deadlines.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting deadline:', error);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
      </div>
    );
  }

  const reminderOptions = [
    { value: '15', label: '15 phút' },
    { value: '30', label: '30 phút' },
    { value: '60', label: '60 phút' },
    { value: '1440', label: '1 ngày' },
  ];

  return (
    <div className="container" style={{ paddingTop: 24, display: 'flex', gap: 32 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <h1 className="heading-xl">Quản lý Thời khóa biểu</h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-card)', borderRadius: 'var(--rounded-full)', padding: 4, gap: 4 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {schedules.map((schedule) => (
                  <div key={schedule.id} style={{ display: 'flex', alignItems: 'center', gap: 2, background: activeScheduleId === schedule.id ? 'white' : 'transparent', borderRadius: 'var(--rounded-full)', paddingRight: 4 }}>
                    <button
                      onClick={() => handleSwitchSchedule(schedule.id)}
                      style={{
                        padding: '8px 12px 8px 16px', border: 'none',
                        background: 'transparent',
                        borderRadius: 'var(--rounded-full)',
                        fontWeight: activeScheduleId === schedule.id ? 700 : 500,
                        cursor: 'pointer', fontSize: 13,
                        color: activeScheduleId === schedule.id ? 'var(--primary)' : 'var(--body)'
                      }}
                    >
                      {schedule.source === 'ai' ? `✨ ${schedule.name}` : schedule.name}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(schedule.id); }}
                      style={{ 
                        width: 24, height: 24, borderRadius: '50%', border: 'none', 
                        background: 'transparent', display: 'flex', alignItems: 'center', 
                        justifyContent: 'center', cursor: 'pointer', color: 'var(--mute)',
                        opacity: activeScheduleId === schedule.id ? 1 : 0.5
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--mute)'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setShowScheduleModal(true)}
                style={{ 
                  width: 32, height: 32, borderRadius: '50%', border: 'none', 
                  background: 'white', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', cursor: 'pointer', color: 'var(--primary)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                <Plus size={16} />
              </button>
              {schedules.length === 0 && (
                <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--mute)' }}>Chưa có lịch nào</div>
              )}
            </div>
            {activeScheduleId && (
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <button
                  className="btn-secondary"
                  style={{ gap: 8, flex: 1, borderRadius: 'var(--rounded-full)', fontSize: 14 }}
                  onClick={() => setShowEntryModal(true)}
                >
                  <Plus size={18} /> Thêm tiết học
                </button>
                <button
                  className="btn-primary"
                  style={{ gap: 8, flex: 1.5, background: isSaved ? '#103c25' : 'var(--primary)' }}
                  onClick={handleSetActive}
                >
                  {isSaved ? <Check size={18} /> : <Save size={18} />}
                  {isSaved ? 'Đã lưu' : 'Lưu phương án'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'white', borderRadius: 'var(--rounded-md)', border: '1px solid var(--hairline)' }}>
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
                  <div 
                    key={time} 
                    onClick={() => handleGridClick(i, time)}
                    style={{ 
                      height: 80, borderBottom: '1px dotted var(--hairline)',
                      cursor: 'pointer', transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  ></div>
                ))}

                {(() => {
                  const now = currentTime;
                  const currentHour = now.getHours();
                  const currentMin = now.getMinutes();
                  if (currentHour >= 7 && currentHour < 18) {
                    const top = (currentHour - 7) * 80 + (currentMin / 60) * 80;
                    return (
                      <div style={{
                        position: 'absolute', top, left: 0, right: 0,
                        height: 2, background: 'var(--primary)', zIndex: 20,
                        pointerEvents: 'none', display: 'flex', alignItems: 'center'
                      }}>
                        <div style={{
                          position: 'absolute', left: -4, top: -4,
                          width: 10, height: 10, borderRadius: '50%',
                          background: 'var(--primary)', border: '2px solid white'
                        }} />
                        <span style={{ 
                          position: 'absolute', right: 4, top: -14, 
                          fontSize: 10, fontWeight: 700, color: 'var(--primary)',
                          background: 'white', padding: '0 4px', borderRadius: 4
                        }}>Hiện tại</span>
                      </div>
                    );
                  }
                  return null;
                })()}

                {currentEntries.filter(e => e.day_of_week === i + 1).map(event => {
                  const startTime = event.start_time?.substring(0, 5) || '07:00';
                  const endTime = event.end_time?.substring(0, 5) || '08:00';
                  const startIndex = timeSlots.indexOf(startTime);
                  const endIndex = timeSlots.indexOf(endTime);
                  if (startIndex === -1 || endIndex === -1) return null;
                  const height = (endIndex - startIndex) * 80;
                  const top = startIndex * 80;

                  return (
                    <div 
                      key={event.id} 
                      onClick={(e) => { e.stopPropagation(); handleEditEntry(event); }}
                      style={{
                        position: 'absolute', top: top + 4, left: 4, right: 4, height: height - 8,
                        background: event.entry_type === 'ai' ? 'linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)' : '#e0f2fe',
                        borderRadius: 8, padding: 12, fontSize: 12, border: '1px solid rgba(0,0,0,0.05)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)', zIndex: 10, cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{event.title}</div>
                      <div style={{ opacity: 0.7 }}>{event.room || 'N/A'} {event.section?.instructor ? `• ${event.section.instructor}` : ''}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

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
          {deadlines.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--mute)', background: 'var(--surface-soft)', borderRadius: 12 }}>
              Chưa có ghi chú nào
            </div>
          )}
          {deadlines.map(d => (
            <div key={d.id} style={{
              padding: 16, background: 'white', borderRadius: 'var(--rounded-md)',
              border: '1px solid var(--hairline)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="caption-sm" style={{ fontWeight: 700, color: 'var(--primary)' }}>{d.subject || 'Ghi chú'}</span>
                <button 
                  onClick={() => handleDeleteDeadline(d.id)} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ash)', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ash)'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <h4 className="body-strong" style={{ marginBottom: 4 }}>{d.title}</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--mute)' }}>
                <Clock size={14} /> {new Date(d.due_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={showDeadlineModal} onClose={() => setShowDeadlineModal(false)} title="Thêm ghi chú mới" width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Tiêu đề sự kiện</label>
            <div className="search-container">
              <Plus size={18} />
              <input 
                type="text" 
                className="input-field search-bar" 
                placeholder="Ví dụ: Kiểm tra Giải tích, Nộp bài tập..." 
                style={{ background: 'white', border: '1px solid var(--hairline)' }}
                value={newDeadline.title} 
                onChange={e => setNewDeadline({...newDeadline, title: e.target.value})} 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Môn học liên quan</label>
            <div className="search-container">
              <AlertCircle size={18} />
              <input 
                type="text" 
                className="input-field search-bar" 
                placeholder="Môn học (không bắt buộc)..." 
                style={{ background: 'white', border: '1px solid var(--hairline)' }}
                value={newDeadline.subject} 
                onChange={e => setNewDeadline({...newDeadline, subject: e.target.value})} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Ngày đến hạn</label>
              <div className="search-container" style={{ position: 'relative' }}>
                <Calendar size={18} style={{ zIndex: 1 }} />
                <input 
                  ref={dateInputRef}
                  type="date" 
                  style={{ 
                    position: 'absolute', top: 0, left: 0, opacity: 0, 
                    width: '100%', height: '100%', zIndex: 2,
                    pointerEvents: 'none' 
                  }}
                  value={newDeadline.date} 
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setNewDeadline({...newDeadline, date: e.target.value})} 
                />
                <button 
                  type="button"
                  className="input-field search-bar" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDeadlineTimeOpen(false);
                    setIsReminderOpen(false);
                    if (dateInputRef.current?.showPicker) {
                      dateInputRef.current.showPicker();
                    } else {
                      dateInputRef.current?.click();
                    }
                  }}
                  style={{ 
                    background: 'white', border: '1px solid var(--hairline)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingRight: 20, cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  {newDeadline.date ? new Date(newDeadline.date).toLocaleDateString('vi-VN') : 'Chọn ngày'}
                </button>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Giờ</label>
              <div className="search-container" style={{ position: 'relative' }}>
                <Clock size={18} style={{ zIndex: 1 }} />
                <button 
                  type="button"
                  onClick={() => {
                    setIsDeadlineTimeOpen(!isDeadlineTimeOpen);
                    setIsReminderOpen(false);
                  }}
                  className="input-field search-bar" 
                  style={{ 
                    background: 'white', border: '1px solid var(--hairline)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingRight: 20, cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  {newDeadline.time}
                </button>
                {isDeadlineTimeOpen && (
                  <div style={{ 
                    position: 'absolute', top: '105%', left: 0, width: '100%', 
                    maxHeight: 200, overflowY: 'auto',
                    background: 'white', borderRadius: 'var(--rounded-md)', 
                    boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 1000,
                    padding: '8px', border: '1px solid var(--hairline)'
                  }}>
                    {timeSlots
                      .filter(t => {
                        if (newDeadline.date === new Date().toISOString().split('T')[0]) {
                          const [h, m] = t.split(':').map(Number);
                          const now = new Date();
                          return h > now.getHours() || (h === now.getHours() && m > now.getMinutes());
                        }
                        return true;
                      })
                      .map(t => (
                        <div 
                          key={t}
                          onClick={() => { setNewDeadline({...newDeadline, time: t}); setIsDeadlineTimeOpen(false); }}
                          style={{ 
                            padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                            cursor: 'pointer', fontSize: 14, background: newDeadline.time === t ? 'var(--surface-soft)' : 'transparent'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = newDeadline.time === t ? 'var(--surface-soft)' : 'transparent'}
                        >
                          {t}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Nhắc trước</label>
            <div className="search-container" style={{ position: 'relative' }}>
              <Clock size={18} style={{ zIndex: 1 }} />
              <button 
                type="button"
                onClick={() => {
                  setIsReminderOpen(!isReminderOpen);
                  setIsDeadlineTimeOpen(false);
                }}
                className="input-field search-bar" 
                style={{ 
                  background: 'white', border: '1px solid var(--hairline)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingRight: 20, cursor: 'pointer', textAlign: 'left'
                }}
              >
                {reminderOptions.find(opt => opt.value === newDeadline.remind_before_minutes)?.label || '30 phút'}
              </button>

              {isReminderOpen && (
                <div style={{ 
                  position: 'absolute', top: '105%', left: 0, width: '100%', 
                  background: 'white', borderRadius: 'var(--rounded-md)', 
                  boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 1000,
                  overflow: 'hidden', padding: '8px', border: '1px solid var(--hairline)'
                }}>
                  {reminderOptions.map(opt => (
                    <div 
                      key={opt.value}
                      onClick={() => { 
                        setNewDeadline({...newDeadline, remind_before_minutes: opt.value}); 
                        setIsReminderOpen(false); 
                      }}
                      style={{ 
                        padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                        cursor: 'pointer', fontSize: 14, fontWeight: newDeadline.remind_before_minutes === opt.value ? 700 : 500,
                        background: newDeadline.remind_before_minutes === opt.value ? 'var(--surface-soft)' : 'transparent',
                        color: newDeadline.remind_before_minutes === opt.value ? 'var(--primary)' : 'var(--body)',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = newDeadline.remind_before_minutes === opt.value ? 'var(--surface-soft)' : 'transparent'}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Ghi chú thêm</label>
            <div className="search-container">
              <Info size={18} style={{ top: 16 }} />
              <textarea 
                className="input-field search-bar" 
                placeholder="Mô tả chi tiết, địa điểm..." 
                style={{ height: 100, resize: 'none', padding: '12px 20px 12px 44px', background: 'white', border: '1px solid var(--hairline)' }} 
                value={newDeadline.description} 
                onChange={e => setNewDeadline({...newDeadline, description: e.target.value})} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button className="btn-secondary" style={{ flex: 1, borderRadius: 'var(--rounded-full)', height: 48 }} onClick={() => setShowDeadlineModal(false)}>Hủy</button>
            <button className="btn-primary" style={{ flex: 1, borderRadius: 'var(--rounded-full)', height: 48 }} onClick={handleAddDeadline}>Lưu lại</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showScheduleModal} onClose={() => setShowScheduleModal(false)} title="Thêm phương án mới" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Tên phương án</label>
            <div className="search-container">
              <Plus size={18} />
              <input 
                type="text" 
                className="input-field search-bar" 
                placeholder="Ví dụ: Phương án học kỳ 2..." 
                style={{ background: 'white', border: '1px solid var(--hairline)' }}
                value={newScheduleName} 
                onChange={e => setNewScheduleName(e.target.value)} 
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-secondary" style={{ flex: 1, borderRadius: 'var(--rounded-full)', height: 48 }} onClick={() => setShowScheduleModal(false)}>Hủy</button>
            <button className="btn-primary" style={{ flex: 1, borderRadius: 'var(--rounded-full)', height: 48 }} onClick={handleAddSchedule}>Tạo mới</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEntryModal} onClose={() => { setShowEntryModal(false); setEditingEntry(null); }} title={editingEntry ? "Chỉnh sửa tiết học" : "Thêm tiết học mới"} width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Tên môn học/Tiết học</label>
            <div className="search-container">
              <Plus size={18} />
              <input 
                type="text" 
                className="input-field search-bar" 
                placeholder="Ví dụ: Giải tích 1, Triết học..." 
                style={{ background: 'white', border: '1px solid var(--hairline)' }}
                value={newEntry.title} 
                onChange={e => setNewEntry({...newEntry, title: e.target.value})} 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Phòng học</label>
            <div className="search-container">
              <AlertCircle size={18} />
              <input 
                type="text" 
                className="input-field search-bar" 
                placeholder="Ví dụ: A1-102, Zoom..." 
                style={{ background: 'white', border: '1px solid var(--hairline)' }}
                value={newEntry.room} 
                onChange={e => setNewEntry({...newEntry, room: e.target.value})} 
              />
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Ngày trong tuần</label>
            <div className="search-container" style={{ position: 'relative' }}>
              <Calendar size={18} style={{ zIndex: 1 }} />
              <button 
                type="button"
                onClick={() => {
                  setIsDayOpen(!isDayOpen);
                  setIsStartTimeOpen(false);
                  setIsEndTimeOpen(false);
                }}
                className="input-field search-bar" 
                style={{ 
                  background: 'white', border: '1px solid var(--hairline)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingRight: 20, cursor: 'pointer', textAlign: 'left'
                }}
              >
                {days[newEntry.day_of_week - 1]}
              </button>

              {isDayOpen && (
                <div style={{ 
                  position: 'absolute', top: '105%', left: 0, width: '100%', 
                  background: 'white', borderRadius: 'var(--rounded-md)', 
                  boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 1000,
                  overflow: 'hidden', padding: '8px', border: '1px solid var(--hairline)'
                }}>
                  {days.map((day, idx) => (
                    <div 
                      key={day}
                      onClick={() => { 
                        setNewEntry({...newEntry, day_of_week: idx + 1}); 
                        setIsDayOpen(false); 
                      }}
                      style={{ 
                        padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                        cursor: 'pointer', fontSize: 14, fontWeight: newEntry.day_of_week === idx + 1 ? 700 : 500,
                        background: newEntry.day_of_week === idx + 1 ? 'var(--surface-soft)' : 'transparent',
                        color: newEntry.day_of_week === idx + 1 ? 'var(--primary)' : 'var(--body)',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = newEntry.day_of_week === idx + 1 ? 'var(--surface-soft)' : 'transparent'}
                    >
                      {day}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Giờ bắt đầu</label>
              <div className="search-container" style={{ position: 'relative' }}>
                <Clock size={18} style={{ zIndex: 1 }} />
                <button 
                  type="button"
                  onClick={() => {
                    setIsStartTimeOpen(!isStartTimeOpen);
                    setIsDayOpen(false);
                    setIsEndTimeOpen(false);
                  }}
                  className="input-field search-bar" 
                  style={{ 
                    background: 'white', border: '1px solid var(--hairline)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingRight: 20, cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  {newEntry.start_time}
                </button>
                {isStartTimeOpen && (
                  <div style={{ 
                    position: 'absolute', top: '105%', left: 0, width: '100%', 
                    maxHeight: 200, overflowY: 'auto',
                    background: 'white', borderRadius: 'var(--rounded-md)', 
                    boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 1000,
                    padding: '8px', border: '1px solid var(--hairline)'
                  }}>
                    {timeSlots.map(t => (
                      <div 
                        key={t}
                        onClick={() => { setNewEntry({...newEntry, start_time: t}); setIsStartTimeOpen(false); }}
                        style={{ 
                          padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                          cursor: 'pointer', fontSize: 14, background: newEntry.start_time === t ? 'var(--surface-soft)' : 'transparent'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = newEntry.start_time === t ? 'var(--surface-soft)' : 'transparent'}
                      >
                        {t}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Giờ kết thúc</label>
              <div className="search-container" style={{ position: 'relative' }}>
                <Clock size={18} style={{ zIndex: 1 }} />
                <button 
                  type="button"
                  onClick={() => {
                    setIsEndTimeOpen(!isEndTimeOpen);
                    setIsDayOpen(false);
                    setIsStartTimeOpen(false);
                  }}
                  className="input-field search-bar" 
                  style={{ 
                    background: 'white', border: '1px solid var(--hairline)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingRight: 20, cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  {newEntry.end_time}
                </button>
                {isEndTimeOpen && (
                  <div style={{ 
                    position: 'absolute', top: '105%', left: 0, width: '100%', 
                    maxHeight: 200, overflowY: 'auto',
                    background: 'white', borderRadius: 'var(--rounded-md)', 
                    boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 1000,
                    padding: '8px', border: '1px solid var(--hairline)'
                  }}>
                    {timeSlots.map(t => (
                      <div 
                        key={t}
                        onClick={() => { setNewEntry({...newEntry, end_time: t}); setIsEndTimeOpen(false); }}
                        style={{ 
                          padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                          cursor: 'pointer', fontSize: 14, background: newEntry.end_time === t ? 'var(--surface-soft)' : 'transparent'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = newEntry.end_time === t ? 'var(--surface-soft)' : 'transparent'}
                      >
                        {t}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {editingEntry && (
              <button 
                className="btn-secondary" 
                style={{ flex: 1, borderRadius: 'var(--rounded-full)', height: 48, borderColor: '#fee2e2', color: '#ef4444', transition: 'all 0.2s' }} 
                onClick={handleDeleteEntry}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
              >
                Xóa tiết học
              </button>
            )}
            <button className="btn-secondary" style={{ flex: 1, borderRadius: 'var(--rounded-full)', height: 48 }} onClick={() => { setShowEntryModal(false); setEditingEntry(null); }}>Hủy</button>
            <button className="btn-primary" style={{ flex: 1, borderRadius: 'var(--rounded-full)', height: 48 }} onClick={handleAddEntry}>
              {editingEntry ? 'Cập nhật' : 'Lưu lại'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Timetable;
