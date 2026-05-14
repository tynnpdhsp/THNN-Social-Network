import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const hoisted = vi.hoisted(() => ({
  getSchedules: vi.fn(),
  getStudyNotes: vi.fn(),
  getScheduleEntries: vi.fn(),
}));

vi.mock('@/services/scheduleService.js', () => ({
  getSchedules: hoisted.getSchedules,
  getStudyNotes: hoisted.getStudyNotes,
  getScheduleEntries: hoisted.getScheduleEntries,
  createSchedule: vi.fn(),
  createScheduleEntry: vi.fn(),
  updateScheduleEntry: vi.fn(),
  deleteScheduleEntry: vi.fn(),
  deleteSchedule: vi.fn(),
  setActiveSchedule: vi.fn(),
  createStudyNote: vi.fn(),
  deleteStudyNote: vi.fn(),
  importCourseSections: vi.fn(),
  importCourseSectionsExcel: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

import { toast } from 'react-hot-toast';
import Timetable from '@/components/Timetable/Timetable.jsx';

describe('Timetable — fetch & initial state', () => {
  let origRaf;

  beforeEach(() => {
    origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };
    vi.clearAllMocks();
    hoisted.getSchedules.mockReset();
    hoisted.getStudyNotes.mockReset();
    hoisted.getScheduleEntries.mockReset();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf;
    vi.useRealTimers();
  });

  it('mount_calls_getSchedules_and_getStudyNotes_in_parallel', async () => {
    hoisted.getSchedules.mockResolvedValue({
      items: [{ id: 'a', name: 'P1', is_active: true, source: 'manual' }],
    });
    hoisted.getStudyNotes.mockResolvedValue({ items: [] });
    hoisted.getScheduleEntries.mockResolvedValue([]);
    render(<Timetable />);
    await waitFor(() => {
      expect(hoisted.getSchedules).toHaveBeenCalledTimes(1);
      expect(hoisted.getStudyNotes).toHaveBeenCalledTimes(1);
    });
  });

  it('when_active_flag_on_item_fetchEntries_for_that_id', async () => {
    hoisted.getSchedules.mockResolvedValue({
      items: [
        { id: 'inactive', name: 'Old', is_active: false, source: 'manual' },
        { id: 'active', name: 'Cur', is_active: true, source: 'manual' },
      ],
    });
    hoisted.getStudyNotes.mockResolvedValue({ items: [] });
    hoisted.getScheduleEntries.mockResolvedValue([
      { id: 1, day_of_week: 1, start_time: '08:00:00', end_time: '09:00:00', title: 'A', room: 'R1', entry_type: 'custom' },
    ]);
    render(<Timetable />);
    await waitFor(() => expect(hoisted.getScheduleEntries).toHaveBeenCalledWith('active'));
    await screen.findByText('A');
  });

  it('when_no_is_active_uses_first_item_as_active', async () => {
    hoisted.getSchedules.mockResolvedValue({
      items: [
        { id: 'first', name: 'First', is_active: false, source: 'manual' },
        { id: 'second', name: 'Second', is_active: false, source: 'manual' },
      ],
    });
    hoisted.getStudyNotes.mockResolvedValue({ items: [] });
    hoisted.getScheduleEntries.mockResolvedValue([]);
    render(<Timetable />);
    await waitFor(() => expect(hoisted.getScheduleEntries).toHaveBeenCalledWith('first'));
    await screen.findByRole('button', { name: 'First' });
  });

  it('when_schedules_empty_active_null_and_no_entries_fetch', async () => {
    hoisted.getSchedules.mockResolvedValue({ items: [] });
    hoisted.getStudyNotes.mockResolvedValue({ items: [] });
    render(<Timetable />);
    await waitFor(() => {
      expect(hoisted.getSchedules).toHaveBeenCalled();
      expect(hoisted.getScheduleEntries).not.toHaveBeenCalled();
    });
    await screen.findByText('Chưa có lịch nào');
  });

  it('initial_load_failure_toasts_and_stops_loading', async () => {
    hoisted.getSchedules.mockRejectedValue(new Error('network'));
    hoisted.getStudyNotes.mockResolvedValue({ items: [] });
    render(<Timetable />);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Không thể tải dữ liệu thời khóa biểu')
    );
    await screen.findByText('Quản lý Thời khóa biểu');
  });

  it('initial_load_failure_when_getStudyNotes_rejects_also_toasts', async () => {
    hoisted.getSchedules.mockResolvedValue({ items: [] });
    hoisted.getStudyNotes.mockRejectedValue(new Error('notes'));
    render(<Timetable />);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Không thể tải dữ liệu thời khóa biểu')
    );
  });

  it('entries_fetch_failure_shows_toast_after_schedules_ok', async () => {
    hoisted.getSchedules.mockResolvedValue({
      items: [{ id: 's1', name: 'HK', is_active: true, source: 'manual' }],
    });
    hoisted.getStudyNotes.mockResolvedValue({ items: [] });
    hoisted.getScheduleEntries.mockRejectedValue(new Error('entries'));
    render(<Timetable />);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Lỗi khi tải các tiết học')
    );
    await screen.findByText('Quản lý Thời khóa biểu');
  });

  it('study_notes_items_rendered_when_present', async () => {
    hoisted.getSchedules.mockResolvedValue({ items: [] });
    hoisted.getStudyNotes.mockResolvedValue({
      items: [
        {
          id: 99,
          title: 'Nộp bài',
          subject: 'Vật lý',
          due_at: '2026-06-01T10:00:00.000Z',
          description: '',
        },
      ],
    });
    render(<Timetable />);
    await screen.findByText('Nộp bài');
    expect(screen.getByText('Vật lý')).toBeInTheDocument();
  });

  it('interval_60s_advances_without_crashing_ui', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-05-14T14:30:00'));
    hoisted.getSchedules.mockResolvedValue({
      items: [{ id: 's1', name: 'HK', is_active: true, source: 'manual' }],
    });
    hoisted.getStudyNotes.mockResolvedValue({ items: [] });
    hoisted.getScheduleEntries.mockResolvedValue([]);
    render(<Timetable />);
    await screen.findByText('Quản lý Thời khóa biểu');
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => expect(screen.getByText('Quản lý Thời khóa biểu')).toBeInTheDocument());
  });

  it('current_time_indicator_visible_when_hour_between_7_and_22', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-05-14T10:30:00'));
    hoisted.getSchedules.mockResolvedValue({
      items: [{ id: 's1', name: 'HK', is_active: true, source: 'manual' }],
    });
    hoisted.getStudyNotes.mockResolvedValue({ items: [] });
    hoisted.getScheduleEntries.mockResolvedValue([]);
    render(<Timetable />);
    await screen.findByText('Quản lý Thời khóa biểu');
    expect(screen.getAllByText('Hiện tại').length).toBeGreaterThanOrEqual(1);
    vi.useRealTimers();
  });
});
