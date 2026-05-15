import React, { useState, useEffect } from 'react';
import { Clock, Plus, Check, Save, AlertCircle, Trash2, Loader2, ChevronDown, Info, Calendar, Upload, AlertTriangle, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Modal from '../Common/Modal';
import * as scheduleService from '../../services/scheduleService';

const timeSlots = Array.from({ length: 16 }, (_, i) => {
  const startTotal = 390 + i * 50; // 6:30 is 390 mins from 00:00
  const endTotal = startTotal + 50;
  const format = (total) => {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  return {
    label: `Tiết ${i + 1}`,
    range: `${format(startTotal)} - ${format(endTotal)}`,
    start: format(startTotal),
    end: format(endTotal)
  };
});
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
    { id: 4, day: 0, start: '08:00', end: '10:00', title: 'AI Optimized Class', room: 'P.501', instructor: 'AI System' },
    { id: 5, day: 1, start: '08:00', end: '10:00', title: 'AI Optimized Class', room: 'P.501', instructor: 'AI System' },
  ]
};

const Timetable = () => {
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [currentEntries, setCurrentEntries] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importType, setImportType] = useState('excel'); // 'excel' or 'json'
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
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const dateInputRef = React.useRef(null);
  const startTimeInputRef = React.useRef(null);
  const endTimeInputRef = React.useRef(null);
  const deadlineTimeInputRef = React.useRef(null);

  useEffect(() => {
    fetchInitialData();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTimeOffset = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    const totalMins = h * 60 + m;
    // Offset from 6:30 (390 mins). 80px per 50-min period.
    return (totalMins - 390) * (80 / 50);
  };

  const gridScrollRef = React.useRef(null);

  useEffect(() => {
    // No need to scroll by default if only 16 periods
    if (gridScrollRef.current) {
      gridScrollRef.current.scrollTop = 0;
    }
  }, [isLoading]);

  async function fetchInitialData() {
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
      toast.error('Không thể tải dữ liệu thời khóa biểu');
    } finally {
      setIsLoading(false);
    }
  };

  async function fetchEntries(scheduleId) {
    try {
      const entries = await scheduleService.getScheduleEntries(scheduleId);
      setCurrentEntries(entries);
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast.error('Lỗi khi tải các tiết học');
    }
  };

  const handleDeleteSchedule = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận xóa phương án',
      message: 'Bạn có chắc chắn muốn xóa phương án lịch này không? Hành động này không thể hoàn tác.',
      onConfirm: async () => {
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
          toast.success('Đã xóa phương án');
        } catch (error) {
          console.error('Error deleting schedule:', error);
          toast.error('Lỗi khi xóa phương án');
        }
      }
    });
  };

  const handleGridClick = (dayIndex, slot) => {
    setEditingEntry(null);
    setNewEntry({
      title: '',
      room: '',
      day_of_week: dayIndex + 1,
      start_time: slot.start,
      end_time: slot.end,
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

    // Validate time format and logical order
    const [startH, startM] = newEntry.start_time.split(':').map(Number);
    const [endH, endM] = newEntry.end_time.split(':').map(Number);
    const startVal = startH * 60 + startM;
    const endVal = endH * 60 + endM;

    if (endVal <= startVal) {
      toast.error('Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }

    // Check for overlap
    const hasOverlap = currentEntries.some(entry => {
      if (editingEntry && entry.id === editingEntry.id) return false;
      if (parseInt(entry.day_of_week) !== parseInt(newEntry.day_of_week)) return false;

      const [eStartH, eStartM] = entry.start_time.split(':').map(Number);
      const [eEndH, eEndM] = entry.end_time.split(':').map(Number);
      const eStartVal = eStartH * 60 + eStartM;
      const eEndVal = eEndH * 60 + eEndM;

      return Math.max(startVal, eStartVal) < Math.min(endVal, eEndVal);
    });

    if (hasOverlap) {
      toast.error('⚠️ Trùng lịch! Tiết học này bị chồng chéo thời gian.');
      return;
    }

    try {
      if (editingEntry) {
        const updated = await scheduleService.updateScheduleEntry(editingEntry.id, {
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
      toast.success(editingEntry ? 'Đã cập nhật tiết học' : 'Đã thêm tiết học mới');
    } catch (error) {
      console.error('Error saving entry:', error);
      toast.error('Lỗi khi lưu tiết học');
    }
  };

  const handleDeleteEntry = () => {
    if (!editingEntry) return;

    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận xóa tiết học',
      message: `Bạn muốn xóa tiết học "${newEntry.title}"?`,
      onConfirm: async () => {
        try {
          await scheduleService.deleteScheduleEntry(editingEntry.id);
          setCurrentEntries(currentEntries.filter(e => e.id !== editingEntry.id));
          setShowEntryModal(false);
          setEditingEntry(null);
          toast.success('Đã xóa tiết học');
        } catch (error) {
          console.error('Error deleting entry:', error);
          toast.error('Lỗi khi xóa tiết học');
        }
      }
    });
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

  const handleDeleteDeadline = (id) => {
    const deadline = deadlines.find(d => d.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận xóa nhắc nhở',
      message: `Bạn muốn xóa nhắc nhở "${deadline?.title}"?`,
      onConfirm: async () => {
        try {
          await scheduleService.deleteStudyNote(id);
          setDeadlines(deadlines.filter(d => d.id !== id));
          toast.success('Đã xóa nhắc nhở');
        } catch (error) {
          console.error('Error deleting deadline:', error);
          toast.error('Lỗi khi xóa nhắc nhở');
        }
      }
    });
  };

  const handleImportData = async () => {
    try {
      if (importType === 'json') {
        const data = JSON.parse(importJson);
        if (!Array.isArray(data)) throw new Error('Dữ liệu phải là một mảng các lớp học phần');
        await scheduleService.importCourseSections(data);
      } else {
        if (!importFile) throw new Error('Vui lòng chọn file Excel');
        await scheduleService.importCourseSectionsExcel(importFile);
      }

      toast.success('Nhập dữ liệu thành công!');
      setShowImportModal(false);
      setImportJson('');
      setImportFile(null);
      fetchInitialData();
    } catch (error) {
      console.error('Error importing data:', error);
      toast.error('Lỗi: ' + error.message);
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
    <div className="container" style={{ paddingTop: 24, display: 'flex', flexWrap: 'wrap', gap: 32 }}>
      <div style={{ flex: 1, minWidth: 280 }}>
        <div className="timetable-header-bar" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <h1 className="heading-xl">Quản lý Thời khóa biểu</h1>

          <div className="timetable-actions-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-card)', borderRadius: 'var(--rounded-full)', padding: 4, gap: 4 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {schedules.map((schedule) => (
                  <div key={schedule.id} style={{ display: 'flex', alignItems: 'center', background: activeScheduleId === schedule.id ? 'white' : 'transparent', borderRadius: 'var(--rounded-full)', paddingRight: 4 }}>
                    <button
                      onClick={() => handleSwitchSchedule(schedule.id)}
                      style={{
                        padding: '8px 16px', border: 'none',
                        background: 'transparent',
                        borderRadius: 'var(--rounded-full)',
                        fontWeight: activeScheduleId === schedule.id ? 700 : 500,
                        cursor: 'pointer', fontSize: 13,
                        color: activeScheduleId === schedule.id ? 'var(--primary)' : 'var(--body)'
                      }}
                    >
                      {schedule.source === 'ai' ? `✨ ${schedule.name}` : schedule.name}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn-secondary"
                  style={{ borderRadius: 'var(--rounded-full)', fontSize: 13, padding: '0 20px', height: 40, fontWeight: 700 }}
                  onClick={() => setShowEntryModal(true)}
                >
                  <Plus size={18} /> Tiết học
                </button>


                <button
                  className="btn-secondary"
                  style={{ width: 40, height: 40, padding: 0, borderRadius: 'var(--rounded-full)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', border: '1px solid #fee2e2' }}
                  onClick={() => handleDeleteSchedule(activeScheduleId)}
                  title="Xóa phương án này"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'white', borderRadius: 'var(--rounded-md)', border: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 250px)' }}>
          <div ref={gridScrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', position: 'relative' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, minmax(90px, 1fr))', position: 'relative', minHeight: 16 * 80, minWidth: 710 }}>
              {/* Sticky Headers */}
              <div style={{
                position: 'sticky', top: 0, left: 0, zIndex: 50, background: 'var(--surface-soft)',
                borderBottom: '1px solid var(--hairline)', borderRight: '1px solid var(--hairline)',
                height: 48
              }}>
                <span style={{ position: 'absolute', top: 4, right: 8, fontSize: 12, fontWeight: 700, color: 'var(--mute)' }}>Thứ</span>
                <span style={{ position: 'absolute', bottom: 4, left: 8, fontSize: 12, fontWeight: 700, color: 'var(--mute)' }}>Tiết</span>
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <line x1="0" y1="0" x2="80" y2="48" stroke="var(--hairline)" strokeWidth="1" />
                </svg>
              </div>
              {days.map(day => (
                <div key={day} style={{
                  position: 'sticky', top: 0, zIndex: 40, background: 'var(--surface-soft)',
                  borderBottom: '1px solid var(--hairline)', borderRight: '1px solid var(--hairline)',
                  padding: '12px 8px', textAlign: 'center', fontWeight: 700, fontSize: 13, height: 48,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>{day}</div>
              ))}

              {/* Time Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gridRow: '2 / span 16' }}>
                {timeSlots.map(slot => (
                  <div key={slot.label} style={{
                    height: 80, padding: '4px 8px', borderBottom: '1px solid var(--hairline)',
                    borderRight: '1px solid var(--hairline)', fontSize: 11, color: 'var(--mute)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 600,
                    background: 'var(--surface-soft)', gap: 2
                  }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)' }}>{slot.label}</div>
                    <div style={{ opacity: 0.7, fontWeight: 500 }}>{slot.start}</div>
                    <div style={{ opacity: 0.7, fontWeight: 500 }}>{slot.end}</div>
                  </div>
                ))}
              </div>

              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} style={{ position: 'relative', borderRight: '1px solid var(--hairline)', gridRow: '2 / span 16', gridColumn: i + 2 }}>
                  {timeSlots.map(slot => (
                    <div
                      key={slot.label}
                      onClick={() => handleGridClick(i, slot)}
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
                    const totalNow = currentHour * 60 + currentMin;
                    if (totalNow >= 390 && totalNow < 1200) {
                      const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
                      const top = getTimeOffset(timeStr);
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
                    const top = getTimeOffset(startTime);
                    const bottom = getTimeOffset(endTime);
                    const height = bottom - top;

                    return (
                      <div
                        key={event.id}
                        onClick={(e) => { e.stopPropagation(); handleEditEntry(event); }}
                        style={{
                          position: 'absolute', top: top + 4, left: 4, right: 4, height: height - 8,
                          background: event.entry_type === 'ai' ? 'linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)' : '#e0f2fe',
                          borderRadius: 8, padding: '8px 12px', fontSize: 12, border: '1px solid rgba(0,0,0,0.05)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.05)', zIndex: 10, cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', justifyContent: 'center'
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>{event.title}</div>
                        <div style={{ opacity: 0.8, fontSize: 11, marginBottom: 2 }}>{startTime} - {endTime}</div>
                        <div style={{ opacity: 0.7, fontSize: 11 }}>{event.room || 'N/A'} {event.section?.instructor ? `• ${event.section.instructor}` : ''}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 320, flexShrink: 0 }}>
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
                onChange={e => setNewDeadline({ ...newDeadline, title: e.target.value })}
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
                onChange={e => setNewDeadline({ ...newDeadline, subject: e.target.value })}
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
                  onChange={e => setNewDeadline({ ...newDeadline, date: e.target.value })}
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
                <input
                  ref={deadlineTimeInputRef}
                  type="time"
                  style={{
                    position: 'absolute', top: 0, left: 0, opacity: 0,
                    width: '100%', height: '100%', zIndex: 2,
                    pointerEvents: 'none'
                  }}
                  value={newDeadline.time}
                  onChange={e => setNewDeadline({ ...newDeadline, time: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (deadlineTimeInputRef.current?.showPicker) {
                      deadlineTimeInputRef.current.showPicker();
                    } else {
                      deadlineTimeInputRef.current?.click();
                    }
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
                        setNewDeadline({ ...newDeadline, remind_before_minutes: opt.value });
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
                onChange={e => setNewDeadline({ ...newDeadline, description: e.target.value })}
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
            <input
              type="text"
              className="input-field"
              placeholder="Ví dụ: Giải tích 1, Triết học..."
              style={{ background: 'white', border: '1px solid var(--hairline)', padding: '0 16px', height: 44, width: '100%' }}
              value={newEntry.title}
              onChange={e => setNewEntry({ ...newEntry, title: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Phòng học</label>
            <input
              type="text"
              className="input-field"
              placeholder="Ví dụ: A1-102, Zoom..."
              style={{ background: 'white', border: '1px solid var(--hairline)', padding: '0 16px', height: 44, width: '100%' }}
              value={newEntry.room}
              onChange={e => setNewEntry({ ...newEntry, room: e.target.value })}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Ngày trong tuần</label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setIsDayOpen(!isDayOpen);
                  setIsStartTimeOpen(false);
                  setIsEndTimeOpen(false);
                }}
                className="input-field"
                style={{
                  background: 'white', border: '1px solid var(--hairline)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0 16px', height: 44, width: '100%', cursor: 'pointer', textAlign: 'left'
                }}
              >
                <span>{days[newEntry.day_of_week - 1]}</span>
                <ChevronDown size={18} style={{ transform: isDayOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0, color: 'var(--ash)' }} />
              </button>

              {isDayOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setIsDayOpen(false)} />
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, width: '100%', maxHeight: 160, overflowY: 'auto',
                    background: 'white', borderRadius: 'var(--rounded-md)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 1000,
                    padding: '8px', border: '1px solid var(--hairline)',
                    marginTop: 4, animation: 'scaleIn 0.15s ease'
                  }}>
                    {days.map((day, idx) => (
                      <div
                        key={day}
                        onClick={() => {
                          setNewEntry({ ...newEntry, day_of_week: idx + 1 });
                          setIsDayOpen(false);
                        }}
                        style={{
                          padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                          cursor: 'pointer', fontSize: 14, fontWeight: newEntry.day_of_week === idx + 1 ? 700 : 500,
                          background: newEntry.day_of_week === idx + 1 ? 'var(--surface-soft)' : 'transparent',
                          color: newEntry.day_of_week === idx + 1 ? 'var(--primary)' : 'var(--body)',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = newEntry.day_of_week === idx + 1 ? 'var(--surface-soft)' : 'transparent'}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Tiết bắt đầu</label>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsStartTimeOpen(!isStartTimeOpen);
                    setIsDayOpen(false);
                    setIsEndTimeOpen(false);
                  }}
                  className="input-field"
                  style={{
                    background: 'white', border: '1px solid var(--hairline)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 16px', height: 44, width: '100%', cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <span>{`Tiết ${parseInt(newEntry.start_time.split(':')[0]) - 6}`}</span>
                  <ChevronDown size={18} style={{ transform: isStartTimeOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0, color: 'var(--ash)' }} />
                </button>
                {isStartTimeOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setIsStartTimeOpen(false)} />
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, width: '100%', maxHeight: 160, overflowY: 'auto',
                      background: 'white', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-md)',
                      marginTop: 4, padding: '4px 0', boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 1000,
                      animation: 'scaleIn 0.15s ease'
                    }}>
                      {Array.from({ length: 16 }).map((_, i) => {
                        const periodNum = i + 1;
                        const isSelected = parseInt(newEntry.start_time.split(':')[0]) - 6 === periodNum;
                        return (
                          <div
                            key={i}
                            onClick={() => {
                              const h = i + 7;
                              const startTime = `${h.toString().padStart(2, '0')}:00`;
                              const [currEndH] = newEntry.end_time.split(':').map(Number);
                              let endTime = newEntry.end_time;
                              if (currEndH <= h) {
                                endTime = `${(h + 1).toString().padStart(2, '0')}:00`;
                              }
                              setNewEntry({ ...newEntry, start_time: startTime, end_time: endTime });
                              setIsStartTimeOpen(false);
                            }}
                            style={{
                              padding: '10px 16px', margin: '2px 4px', borderRadius: 'var(--rounded-sm)', cursor: 'pointer',
                              fontSize: 14, fontWeight: isSelected ? 700 : 500,
                              background: isSelected ? 'var(--surface-soft)' : 'transparent',
                              color: isSelected ? 'var(--primary)' : 'var(--body)',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'var(--surface-soft)' : 'transparent'}
                          >
                            Tiết {periodNum}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Tiết kết thúc</label>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsEndTimeOpen(!isEndTimeOpen);
                    setIsDayOpen(false);
                    setIsStartTimeOpen(false);
                  }}
                  className="input-field"
                  style={{
                    background: 'white', border: '1px solid var(--hairline)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 16px', height: 44, width: '100%', cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <span>{`Tiết ${parseInt(newEntry.end_time.split(':')[0]) - 7}`}</span>
                  <ChevronDown size={18} style={{ transform: isEndTimeOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0, color: 'var(--ash)' }} />
                </button>
                {isEndTimeOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setIsEndTimeOpen(false)} />
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, width: '100%', maxHeight: 160, overflowY: 'auto',
                      background: 'white', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-md)',
                      marginTop: 4, padding: '4px 0', boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 1000,
                      animation: 'scaleIn 0.15s ease'
                    }}>
                      {Array.from({ length: 16 }).map((_, i) => {
                        const endPeriod = i + 1;
                        const startPeriod = parseInt(newEntry.start_time.split(':')[0]) - 6;
                        if (endPeriod < startPeriod) return null;
                        const endH = i + 8;
                        const isSelected = parseInt(newEntry.end_time.split(':')[0]) - 7 === endPeriod;
                        return (
                          <div
                            key={i}
                            onClick={() => {
                              setNewEntry({ ...newEntry, end_time: `${endH.toString().padStart(2, '0')}:00` });
                              setIsEndTimeOpen(false);
                            }}
                            style={{
                              padding: '10px 16px', margin: '2px 4px', borderRadius: 'var(--rounded-sm)', cursor: 'pointer',
                              fontSize: 14, fontWeight: isSelected ? 700 : 500,
                              background: isSelected ? 'var(--surface-soft)' : 'transparent',
                              color: isSelected ? 'var(--primary)' : 'var(--body)',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'var(--surface-soft)' : 'transparent'}
                          >
                            Tiết {endPeriod}
                          </div>
                        );
                      })}
                    </div>
                  </>
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
      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Nhập dữ liệu thời khóa biểu" width={600}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 12, background: 'var(--surface-soft)', padding: 4, borderRadius: 'var(--rounded-full)' }}>
            <button
              onClick={() => setImportType('excel')}
              style={{ flex: 1, padding: '8px', border: 'none', background: importType === 'excel' ? 'white' : 'transparent', borderRadius: 'var(--rounded-full)', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: importType === 'excel' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
            >
              Nhập từ Excel
            </button>
            <button
              onClick={() => setImportType('json')}
              style={{ flex: 1, padding: '8px', border: 'none', background: importType === 'json' ? 'white' : 'transparent', borderRadius: 'var(--rounded-full)', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: importType === 'json' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
            >
              Nhập từ JSON
            </button>
          </div>

          {importType === 'excel' ? (
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--mute)' }}>Chọn file Excel (.xlsx, .xls)</label>
              <div style={{ border: '2px dashed var(--hairline)', borderRadius: 16, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                <Upload size={32} style={{ color: 'var(--primary)', marginBottom: 12 }} />
                <p style={{ fontSize: 14, color: 'var(--body)', marginBottom: 4 }}>{importFile ? importFile.name : 'Nhấn để chọn hoặc kéo thả file vào đây'}</p>
                <p style={{ fontSize: 12, color: 'var(--mute)' }}>Hỗ trợ các cột: Mã môn, Tên môn, Thứ, Bắt đầu, Kết thúc, Phòng</p>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => setImportFile(e.target.files[0])}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                />
              </div>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--mute)' }}>Dán mã JSON học phần vào đây</label>
              <textarea
                className="input-field"
                placeholder='[{"course_code": "IT101", "course_name": "Lập trình C", "day_of_week": 2, "start_time": "07:00", "end_time": "09:00", "room": "A1-101"}]'
                style={{ height: 250, resize: 'none', padding: 16, fontFamily: 'monospace', fontSize: 13, background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: 12 }}
                value={importJson}
                onChange={e => setImportJson(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-secondary" style={{ flex: 1, borderRadius: 'var(--rounded-full)', height: 48 }} onClick={() => setShowImportModal(false)}>Hủy</button>
            <button className="btn-primary" style={{ flex: 1, borderRadius: 'var(--rounded-full)', height: 48 }} onClick={handleImportData}>Bắt đầu nhập</button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        width={400}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: '#fff1f0',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            margin: '0 auto 24px', color: '#ff4d4f',
            boxShadow: '0 0 0 8px #fff1f033'
          }}>
            <AlertTriangle size={40} strokeWidth={2.5} />
          </div>

          <h2 className="heading-lg" style={{ marginBottom: 12, fontWeight: 800 }}>{confirmModal.title}</h2>
          <p className="body-md" style={{ color: 'var(--mute)', marginBottom: 32, lineHeight: 1.6, padding: '0 10px' }}>
            {confirmModal.message}
          </p>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn-secondary"
              style={{ flex: 1, borderRadius: 'var(--rounded-full)', height: 52, fontWeight: 700 }}
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            >
              Hủy
            </button>
            <button
              className="btn-primary"
              style={{ flex: 1, borderRadius: 'var(--rounded-full)', height: 52, background: '#ff4d4f', borderColor: '#ff4d4f', fontWeight: 700 }}
              onClick={() => {
                confirmModal.onConfirm();
                setConfirmModal({ ...confirmModal, isOpen: false });
              }}
            >
              Xác nhận xóa
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Timetable;
