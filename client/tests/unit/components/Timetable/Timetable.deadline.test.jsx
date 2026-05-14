import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const hoisted = vi.hoisted(() => ({
  getSchedules: vi.fn(),
  getStudyNotes: vi.fn(),
  getScheduleEntries: vi.fn(),
  createStudyNote: vi.fn(),
  deleteStudyNote: vi.fn(),
}));

vi.mock('@/services/scheduleService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getSchedules: hoisted.getSchedules,
    getStudyNotes: hoisted.getStudyNotes,
    getScheduleEntries: hoisted.getScheduleEntries,
    createStudyNote: hoisted.createStudyNote,
    deleteStudyNote: hoisted.deleteStudyNote,
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

async function mountTimetable(deadlines = []) {
  hoisted.getSchedules.mockResolvedValue({ items: [] });
  hoisted.getStudyNotes.mockResolvedValue({ items: deadlines });
  hoisted.getScheduleEntries.mockResolvedValue([]);
  render(<Timetable />);
  await screen.findByText('Quản lý Thời khóa biểu');
}

describe('Timetable — deadlines (study notes)', () => {
  let origRaf;

  beforeEach(() => {
    origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };
    vi.clearAllMocks();
    Object.values(hoisted).forEach((fn) => fn?.mockReset?.());
    hoisted.createStudyNote.mockResolvedValue({
      id: 501,
      title: 'T',
      subject: 'S',
      due_at: '2026-07-01T01:00:00.000Z',
      description: 'd',
      remind_before_minutes: 60,
    });
    hoisted.deleteStudyNote.mockResolvedValue({});
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf;
    vi.useRealTimers();
  });

  it('deadline_plus_opens_modal_and_Hủy_closes', async () => {
    const user = userEvent.setup();
    await mountTimetable([]);
    const plus = [...document.querySelectorAll('button.btn-primary')].find((b) => b.querySelector('svg.lucide-plus'));
    await user.click(plus);
    await screen.findByRole('heading', { name: 'Thêm ghi chú mới' });
    await user.click(within(modalBox()).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Thêm ghi chú mới' })).not.toBeInTheDocument());
  });

  it('save_deadline_without_required_fields_does_not_call_createStudyNote', async () => {
    const user = userEvent.setup();
    await mountTimetable([]);
    const plus = [...document.querySelectorAll('button.btn-primary')].find((b) => b.querySelector('svg.lucide-plus'));
    await user.click(plus);
    await screen.findByRole('heading', { name: 'Thêm ghi chú mới' });
    await user.click(within(modalBox()).getByRole('button', { name: 'Lưu lại' }));
    expect(hoisted.createStudyNote).not.toHaveBeenCalled();
  });

  it('save_deadline_with_title_but_no_date_does_not_call_createStudyNote', async () => {
    const user = userEvent.setup();
    await mountTimetable([]);
    const plus = [...document.querySelectorAll('button.btn-primary')].find((b) => b.querySelector('svg.lucide-plus'));
    await user.click(plus);
    await screen.findByRole('heading', { name: 'Thêm ghi chú mới' });
    await user.type(within(modalBox()).getByPlaceholderText(/Kiểm tra Giải tích/), 'Chỉ tiêu đề');
    await user.click(within(modalBox()).getByRole('button', { name: 'Lưu lại' }));
    expect(hoisted.createStudyNote).not.toHaveBeenCalled();
  });

  it('save_deadline_with_title_date_time_calls_createStudyNote_with_due_at_and_reminder', async () => {
    const user = userEvent.setup();
    await mountTimetable([]);
    const plus = [...document.querySelectorAll('button.btn-primary')].find((b) => b.querySelector('svg.lucide-plus'));
    await user.click(plus);
    await screen.findByRole('heading', { name: 'Thêm ghi chú mới' });
    const modal = modalBox();
    await user.type(within(modal).getByPlaceholderText(/Kiểm tra Giải tích/), 'Giữa kỳ');
    await user.type(within(modal).getByPlaceholderText(/Môn học \(không bắt buộc\)/), 'Toán');
    const dateInput = modal.querySelector('input[type="date"]');
    fireEvent.change(dateInput, { target: { value: '2026-08-15' } });
    await user.click(within(modal).getByText('Nhắc trước').parentElement.querySelector('button[type="button"]'));
    await user.click(within(modal).getByText('60 phút'));
    await user.type(within(modal).getByPlaceholderText(/Mô tả chi tiết/), 'Phòng A1');
    await user.click(within(modal).getByRole('button', { name: 'Lưu lại' }));
    await waitFor(() => expect(hoisted.createStudyNote).toHaveBeenCalledTimes(1));
    const arg = hoisted.createStudyNote.mock.calls[0][0];
    expect(arg.title).toBe('Giữa kỳ');
    expect(arg.subject).toBe('Toán');
    expect(arg.description).toBe('Phòng A1');
    expect(arg.remind_before_minutes).toBe(60);
    expect(arg.due_at).toMatch(/^2026-08-15T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('delete_deadline_confirm_calls_deleteStudyNote_and_success_toast', async () => {
    const user = userEvent.setup();
    await mountTimetable([
      {
        id: 77,
        title: 'XóaDeadline',
        subject: 'SH',
        due_at: '2026-09-01T12:00:00.000Z',
        description: '',
      },
    ]);
    await screen.findByText('XóaDeadline');
    const titleEl = screen.getByText('XóaDeadline');
    const header = titleEl.previousElementSibling;
    const trashBtn = header.querySelector('button');
    await user.click(trashBtn);
    const confirmTitle = await screen.findByRole('heading', { name: 'Xác nhận xóa nhắc nhở' });
    await user.click(within(confirmTitle.closest('.premium-modal-box')).getByRole('button', { name: 'Xác nhận xóa' }));
    await waitFor(() => expect(hoisted.deleteStudyNote).toHaveBeenCalledWith(77));
    expect(toast.success).toHaveBeenCalledWith('Đã xóa nhắc nhở');
  });

  it('delete_deadline_failure_toasts_error', async () => {
    const user = userEvent.setup();
    hoisted.deleteStudyNote.mockRejectedValue(new Error('srv'));
    await mountTimetable([
      {
        id: 88,
        title: 'FailDel',
        subject: 'S',
        due_at: '2026-09-02T12:00:00.000Z',
        description: '',
      },
    ]);
    await screen.findByText('FailDel');
    const titleEl = screen.getByText('FailDel');
    const header = titleEl.previousElementSibling;
    const trashBtn = header.querySelector('button');
    await user.click(trashBtn);
    const confirmTitle = await screen.findByRole('heading', { name: 'Xác nhận xóa nhắc nhở' });
    await user.click(within(confirmTitle.closest('.premium-modal-box')).getByRole('button', { name: 'Xác nhận xóa' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Lỗi khi xóa nhắc nhở'));
  });
});
