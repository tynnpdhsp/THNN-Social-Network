import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const hoisted = vi.hoisted(() => ({
  getSchedules: vi.fn(),
  getStudyNotes: vi.fn(),
  getScheduleEntries: vi.fn(),
  createScheduleEntry: vi.fn(),
  updateScheduleEntry: vi.fn(),
  deleteScheduleEntry: vi.fn(),
  createSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  setActiveSchedule: vi.fn(),
}));

vi.mock('@/services/scheduleService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getSchedules: hoisted.getSchedules,
    getStudyNotes: hoisted.getStudyNotes,
    getScheduleEntries: hoisted.getScheduleEntries,
    createScheduleEntry: hoisted.createScheduleEntry,
    updateScheduleEntry: hoisted.updateScheduleEntry,
    deleteScheduleEntry: hoisted.deleteScheduleEntry,
    createSchedule: hoisted.createSchedule,
    deleteSchedule: hoisted.deleteSchedule,
    setActiveSchedule: hoisted.setActiveSchedule,
  };
});

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

import { toast } from 'react-hot-toast';
import Timetable from '@/components/Timetable/Timetable.jsx';

function modalBox() {
  return document.querySelector('.premium-modal-box');
}

function periodDropdownTrigger(modalRoot, labelText) {
  const label = within(modalRoot).getByText(labelText);
  const row = label.parentElement;
  const btn = row?.querySelector('button[type="button"]');
  if (!btn) throw new Error(`No period button for label: ${labelText}`);
  return btn;
}

async function clickDropdownOptionInModal(user, modalRoot, optionText) {
  const candidates = within(modalRoot).getAllByText(optionText, { exact: true });
  const opt = [...candidates].find(
    (el) =>
      el.tagName === 'DIV' &&
      (el.getAttribute('style') || '').includes('cursor') &&
      (el.getAttribute('style') || '').includes('pointer')
  );
  expect(opt).toBeTruthy();
  await user.click(opt);
}

function firstGridEmptyCell() {
  return [...document.querySelectorAll('div')].find((el) => {
    const s = el.getAttribute('style') || '';
    return (
      s.includes('cursor: pointer') &&
      s.includes('height: 80px') &&
      s.includes('dotted') &&
      typeof el.onclick === 'function'
    );
  });
}

async function mountDefaultTimetable(entries = []) {
  hoisted.getSchedules.mockResolvedValue({
    items: [{ id: 's1', name: 'HK1', is_active: true, source: 'manual' }],
  });
  hoisted.getStudyNotes.mockResolvedValue({ items: [] });
  hoisted.getScheduleEntries.mockResolvedValue(entries);
  render(<Timetable />);
  await screen.findByText('Quản lý Thời khóa biểu');
}

describe('Timetable — entry & schedule CRUD', () => {
  let origRaf;

  beforeEach(() => {
    origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };
    vi.clearAllMocks();
    Object.values(hoisted).forEach((fn) => fn?.mockReset?.());
    hoisted.createScheduleEntry.mockImplementation(async (_id, payload) => ({
      id: 'new-1',
      ...payload,
      start_time: `${payload.start_time}:00`.replace(/:00:00/, ':00:00'),
      end_time: `${payload.end_time}:00`.replace(/:00:00/, ':00:00'),
    }));
    hoisted.updateScheduleEntry.mockImplementation(async (id, payload) => ({
      id,
      ...payload,
      start_time: `${payload.start_time}:00`,
      end_time: `${payload.end_time}:00`,
    }));
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf;
    vi.useRealTimers();
  });

  it('open_entry_modal_via_header_Tiết_học_and_Hủy_closes', async () => {
    const user = userEvent.setup();
    await mountDefaultTimetable([]);
    await user.click(screen.getByRole('button', { name: /Tiết học/ }));
    await screen.findByRole('heading', { name: 'Thêm tiết học mới' });
    await user.click(within(modalBox()).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Thêm tiết học mới' })).not.toBeInTheDocument());
  });

  it('grid_cell_click_opens_entry_modal_with_prefilled_day_and_times', async () => {
    const user = userEvent.setup();
    await mountDefaultTimetable([]);
    const cell = firstGridEmptyCell();
    expect(cell).toBeTruthy();
    await user.click(cell);
    await screen.findByRole('heading', { name: 'Thêm tiết học mới' });
    const surface = modalBox();
    expect(within(surface).getByText('Thứ 2')).toBeInTheDocument();
  });

  it('submit_entry_without_title_does_not_call_createScheduleEntry', async () => {
    const user = userEvent.setup();
    await mountDefaultTimetable([]);
    await user.click(screen.getByRole('button', { name: /Tiết học/ }));
    await screen.findByRole('heading', { name: 'Thêm tiết học mới' });
    await user.click(within(modalBox()).getByRole('button', { name: 'Lưu lại' }));
    expect(hoisted.createScheduleEntry).not.toHaveBeenCalled();
  });

  it('submit_valid_entry_calls_createScheduleEntry_and_closes_modal', async () => {
    const user = userEvent.setup();
    hoisted.createScheduleEntry.mockResolvedValue({
      id: 501,
      day_of_week: 1,
      start_time: '08:00:00',
      end_time: '09:00:00',
      title: 'Vật lý',
      room: 'A1',
      entry_type: 'custom',
    });
    await mountDefaultTimetable([]);
    await user.click(screen.getByRole('button', { name: /Tiết học/ }));
    await screen.findByRole('heading', { name: 'Thêm tiết học mới' });
    await user.type(screen.getByPlaceholderText(/Giải tích/), 'Vật lý');
    await user.click(within(modalBox()).getByRole('button', { name: 'Lưu lại' }));
    await waitFor(() => {
      expect(hoisted.createScheduleEntry).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({
          title: 'Vật lý',
          day_of_week: 1,
          entry_type: 'custom',
        })
      );
    });
    expect(toast.success).toHaveBeenCalledWith('Đã thêm tiết học mới');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Thêm tiết học mới' })).not.toBeInTheDocument());
  });

  it('createScheduleEntry_rejected_shows_error_toast_and_keeps_modal_open', async () => {
    const user = userEvent.setup();
    hoisted.createScheduleEntry.mockRejectedValue(new Error('srv'));
    await mountDefaultTimetable([]);
    await user.click(screen.getByRole('button', { name: /Tiết học/ }));
    await screen.findByRole('heading', { name: 'Thêm tiết học mới' });
    await user.type(screen.getByPlaceholderText(/Giải tích/), 'LỗiLưu');
    await user.click(within(modalBox()).getByRole('button', { name: 'Lưu lại' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Lỗi khi lưu tiết học'));
    expect(screen.getByRole('heading', { name: 'Thêm tiết học mới' })).toBeInTheDocument();
  });

  it('submit_entry_when_end_not_after_start_toasts_validation', async () => {
    const user = userEvent.setup();
    await mountDefaultTimetable([
      {
        id: 99,
        day_of_week: 1,
        start_time: '14:00:00',
        end_time: '10:00:00',
        title: 'BadData',
        room: '',
        entry_type: 'custom',
      },
    ]);
    await screen.findByText('BadData');
    await user.click(screen.getByText('BadData'));
    await screen.findByRole('heading', { name: 'Chỉnh sửa tiết học' });
    await user.click(within(modalBox()).getByRole('button', { name: 'Cập nhật' }));
    expect(toast.error).toHaveBeenCalledWith('Giờ kết thúc phải sau giờ bắt đầu');
    expect(hoisted.updateScheduleEntry).not.toHaveBeenCalled();
  });

  it('overlap_with_existing_entry_blocks_save', async () => {
    const user = userEvent.setup();
    await mountDefaultTimetable([
      {
        id: 1,
        day_of_week: 1,
        start_time: '08:00:00',
        end_time: '10:00:00',
        title: 'Busy',
        room: 'R1',
        entry_type: 'custom',
      },
    ]);
    await screen.findByText('Busy');
    await user.click(screen.getByRole('button', { name: /Tiết học/ }));
    await screen.findByRole('heading', { name: 'Thêm tiết học mới' });
    await user.type(screen.getByPlaceholderText(/Giải tích/), 'OverlapTry');
    const modal = modalBox();
    await user.click(periodDropdownTrigger(modal, 'Tiết bắt đầu'));
    await clickDropdownOptionInModal(user, modal, 'Tiết 3');
    await user.click(periodDropdownTrigger(modal, 'Tiết kết thúc'));
    await clickDropdownOptionInModal(user, modal, 'Tiết 4');
    await user.click(within(modal).getByRole('button', { name: 'Lưu lại' }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Trùng lịch'));
    expect(hoisted.createScheduleEntry).not.toHaveBeenCalled();
  });

  it('edit_entry_calls_updateScheduleEntry_and_success_toast', async () => {
    const user = userEvent.setup();
    hoisted.updateScheduleEntry.mockResolvedValue({
      id: 7,
      day_of_week: 2,
      start_time: '09:00:00',
      end_time: '11:00:00',
      title: 'Toán',
      room: 'B2',
      entry_type: 'custom',
    });
    await mountDefaultTimetable([
      {
        id: 7,
        day_of_week: 2,
        start_time: '09:00:00',
        end_time: '10:00:00',
        title: 'Toán',
        room: 'B1',
        entry_type: 'custom',
      },
    ]);
    await user.click(screen.getByText('Toán'));
    await screen.findByRole('heading', { name: 'Chỉnh sửa tiết học' });
    const room = within(modalBox()).getByPlaceholderText(/A1-102/);
    await user.clear(room);
    await user.type(room, 'B2');
    const modal = modalBox();
    await user.click(periodDropdownTrigger(modal, 'Tiết kết thúc'));
    await clickDropdownOptionInModal(user, modal, 'Tiết 4');
    await user.click(within(modal).getByRole('button', { name: 'Cập nhật' }));
    await waitFor(() =>
      expect(hoisted.updateScheduleEntry).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ title: 'Toán', room: 'B2' })
      )
    );
    expect(toast.success).toHaveBeenCalledWith('Đã cập nhật tiết học');
  });

  it('delete_entry_confirm_calls_deleteScheduleEntry', async () => {
    const user = userEvent.setup();
    hoisted.deleteScheduleEntry.mockResolvedValue({});
    await mountDefaultTimetable([
      {
        id: 44,
        day_of_week: 3,
        start_time: '10:00:00',
        end_time: '11:00:00',
        title: 'XoáTôi',
        room: 'Z',
        entry_type: 'custom',
      },
    ]);
    await user.click(screen.getByText('XoáTôi'));
    await screen.findByRole('heading', { name: 'Chỉnh sửa tiết học' });
    await user.click(within(modalBox()).getByRole('button', { name: 'Xóa tiết học' }));
    const confirmTitle = await screen.findByRole('heading', { name: 'Xác nhận xóa tiết học' });
    const confirmBox = confirmTitle.closest('.premium-modal-box');
    await user.click(within(confirmBox).getByRole('button', { name: 'Xác nhận xóa' }));
    await waitFor(() => expect(hoisted.deleteScheduleEntry).toHaveBeenCalledWith(44));
    expect(toast.success).toHaveBeenCalledWith('Đã xóa tiết học');
  });

  it('add_schedule_modal_create_calls_createSchedule_and_selects_new', async () => {
    const user = userEvent.setup();
    hoisted.createSchedule.mockResolvedValue({ id: 'new-s', name: 'Kỳ phụ', is_active: false, source: 'manual' });
    await mountDefaultTimetable([]);
    const plusSched = document
      .querySelector('.timetable-actions-row')
      ?.querySelector('button svg[width="16"]')
      ?.closest('button');
    expect(plusSched).toBeTruthy();
    await user.click(plusSched);
    await screen.findByRole('heading', { name: 'Thêm phương án mới' });
    await user.type(screen.getByPlaceholderText(/Phương án học kỳ/), 'Kỳ phụ');
    await user.click(screen.getByRole('button', { name: 'Tạo mới' }));
    await waitFor(() =>
      expect(hoisted.createSchedule).toHaveBeenCalledWith({ name: 'Kỳ phụ', source: 'manual' })
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kỳ phụ' })).toBeInTheDocument());
  });

  it('switch_schedule_tab_calls_fetchEntries_for_that_id', async () => {
    const user = userEvent.setup();
    hoisted.getSchedules.mockResolvedValue({
      items: [
        { id: 'a', name: 'A', is_active: false, source: 'manual' },
        { id: 'b', name: 'B', is_active: true, source: 'manual' },
      ],
    });
    hoisted.getStudyNotes.mockResolvedValue({ items: [] });
    hoisted.getScheduleEntries.mockResolvedValue([]);
    render(<Timetable />);
    await screen.findByText('Quản lý Thời khóa biểu');
    hoisted.getScheduleEntries.mockClear();
    await user.click(screen.getByRole('button', { name: 'A' }));
    await waitFor(() => expect(hoisted.getScheduleEntries).toHaveBeenCalledWith('a'));
  });

  it('delete_active_schedule_confirm_switches_to_remaining', async () => {
    const user = userEvent.setup();
    hoisted.getSchedules.mockResolvedValue({
      items: [
        { id: 'keep', name: 'Giữ', is_active: false, source: 'manual' },
        { id: 'gone', name: 'XóaT', is_active: true, source: 'manual' },
      ],
    });
    hoisted.getStudyNotes.mockResolvedValue({ items: [] });
    hoisted.getScheduleEntries.mockResolvedValue([]);
    hoisted.deleteSchedule.mockResolvedValue({});
    render(<Timetable />);
    await screen.findByRole('button', { name: 'XóaT' });
    hoisted.getScheduleEntries.mockClear();
    const trash = screen.getByTitle('Xóa phương án này');
    await user.click(trash);
    await screen.findByRole('heading', { name: 'Xác nhận xóa phương án' });
    const confirmTitle = await screen.findByRole('heading', { name: 'Xác nhận xóa phương án' });
    await user.click(within(confirmTitle.closest('.premium-modal-box')).getByRole('button', { name: 'Xác nhận xóa' }));
    await waitFor(() => expect(hoisted.deleteSchedule).toHaveBeenCalledWith('gone'));
    await waitFor(() => expect(hoisted.getScheduleEntries).toHaveBeenCalledWith('keep'));
  });
});
