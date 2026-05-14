import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const hoisted = vi.hoisted(() => ({
  uploadDocument: vi.fn(),
}));

vi.mock('@/services/documentService.js', () => ({
  uploadDocument: (...a) => hoisted.uploadDocument(...a),
}));

import UploadDocModal from '@/components/StudyDocs/UploadDocModal.jsx';

const CATEGORIES = [
  { id: 'cat-a', name: 'Loại A' },
  { id: 'cat-b', name: 'Loại B' },
];

describe('UploadDocModal', () => {
  const onClose = vi.fn();
  const onUploadSuccess = vi.fn();
  let origRaf;

  beforeEach(() => {
    origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };
    vi.clearAllMocks();
    hoisted.uploadDocument.mockResolvedValue({});
    onClose.mockClear();
    onUploadSuccess.mockClear();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf;
  });

  it('isOpen_false_modal_not_visible', () => {
    render(
      <UploadDocModal isOpen={false} onClose={onClose} onUploadSuccess={onUploadSuccess} categories={CATEGORIES} />
    );
    expect(screen.queryByRole('heading', { name: /Tải lên tài liệu mới/ })).not.toBeInTheDocument();
  });

  it('submit_without_file_sets_error', async () => {
    const user = userEvent.setup();
    render(
      <UploadDocModal isOpen onClose={onClose} onUploadSuccess={onUploadSuccess} categories={CATEGORIES} />
    );
    await screen.findByRole('heading', { name: /Tải lên tài liệu mới/ });
    await user.type(screen.getByPlaceholderText(/Ví dụ: Đề cương/), 'Tiêu đề');
    await user.click(screen.getByRole('button', { name: /Chọn danh mục/ }));
    await user.click(screen.getByText('Loại A'));
    fireEvent.submit(screen.getByPlaceholderText(/Ví dụ: Đề cương/).closest('form'));
    expect(await screen.findByText('Vui lòng chọn tệp tài liệu')).toBeInTheDocument();
    expect(hoisted.uploadDocument).not.toHaveBeenCalled();
  });

  it('submit_without_title_sets_error', async () => {
    const user = userEvent.setup();
    render(
      <UploadDocModal isOpen onClose={onClose} onUploadSuccess={onUploadSuccess} categories={CATEGORIES} />
    );
    await screen.findByRole('heading', { name: /Tải lên tài liệu mới/ });
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]');
    await user.upload(input, file);
    await user.click(screen.getByRole('button', { name: /Chọn danh mục/ }));
    await user.click(screen.getByText('Loại A'));
    await user.clear(screen.getByPlaceholderText(/Ví dụ: Đề cương/));
    fireEvent.submit(screen.getByPlaceholderText(/Ví dụ: Đề cương/).closest('form'));
    expect(await screen.findByText('Vui lòng nhập tiêu đề')).toBeInTheDocument();
    expect(hoisted.uploadDocument).not.toHaveBeenCalled();
  });

  it('submit_without_category_sets_error', async () => {
    const user = userEvent.setup();
    render(
      <UploadDocModal isOpen onClose={onClose} onUploadSuccess={onUploadSuccess} categories={CATEGORIES} />
    );
    await screen.findByRole('heading', { name: /Tải lên tài liệu mới/ });
    const file = new File(['x'], 'only.pdf', { type: 'application/pdf' });
    await user.upload(document.querySelector('input[type="file"]'), file);
    await user.type(screen.getByPlaceholderText(/Ví dụ: Đề cương/), 'Có title');
    fireEvent.submit(screen.getByPlaceholderText(/Ví dụ: Đề cương/).closest('form'));
    expect(await screen.findByText('Vui lòng chọn danh mục')).toBeInTheDocument();
    expect(hoisted.uploadDocument).not.toHaveBeenCalled();
  });

  it('file_over_50mb_sets_error_and_does_not_set_file', async () => {
    const user = userEvent.setup();
    render(
      <UploadDocModal isOpen onClose={onClose} onUploadSuccess={onUploadSuccess} categories={CATEGORIES} />
    );
    await screen.findByRole('heading', { name: /Tải lên tài liệu mới/ });
    const big = new File([new Uint8Array(50 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' });
    await user.upload(document.querySelector('input[type="file"]'), big);
    expect(await screen.findByText(/Tệp quá lớn/)).toBeInTheDocument();
    expect(screen.queryByText('big.pdf')).not.toBeInTheDocument();
  });

  it('valid_file_without_title_sets_title_from_filename_stem', async () => {
    const user = userEvent.setup();
    render(
      <UploadDocModal isOpen onClose={onClose} onUploadSuccess={onUploadSuccess} categories={CATEGORIES} />
    );
    await screen.findByRole('heading', { name: /Tải lên tài liệu mới/ });
    const file = new File(['c'], 'MyReport.final.pdf', { type: 'application/pdf' });
    await user.upload(document.querySelector('input[type="file"]'), file);
    expect(screen.getByPlaceholderText(/Ví dụ: Đề cương/)).toHaveValue('MyReport.final');
  });

  it('successful_submit_calls_uploadDocument_onUploadSuccess_reset_and_no_close_from_modal', async () => {
    const user = userEvent.setup();
    render(
      <UploadDocModal isOpen onClose={onClose} onUploadSuccess={onUploadSuccess} categories={CATEGORIES} />
    );
    await screen.findByRole('heading', { name: /Tải lên tài liệu mới/ });
    const file = new File(['z'], 'z.pdf', { type: 'application/pdf' });
    await user.upload(document.querySelector('input[type="file"]'), file);
    await user.click(screen.getByRole('button', { name: /Chọn danh mục/ }));
    await user.click(screen.getByText('Loại B'));
    await user.click(screen.getByRole('button', { name: /Bắt đầu tải lên/ }));

    await waitFor(() => {
      expect(hoisted.uploadDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'z',
          category_id: 'cat-b',
          description: '',
          file: expect.any(File),
        })
      );
      expect(onUploadSuccess).toHaveBeenCalled();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('upload_rejection_sets_error_message', async () => {
    const user = userEvent.setup();
    hoisted.uploadDocument.mockRejectedValueOnce(new Error('quota'));
    render(
      <UploadDocModal isOpen onClose={onClose} onUploadSuccess={onUploadSuccess} categories={CATEGORIES} />
    );
    await screen.findByRole('heading', { name: /Tải lên tài liệu mới/ });
    await user.upload(document.querySelector('input[type="file"]'), new File(['a'], 'a.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: /Chọn danh mục/ }));
    await user.click(screen.getByText('Loại A'));
    await user.click(screen.getByRole('button', { name: /Bắt đầu tải lên/ }));
    expect(await screen.findByText('quota')).toBeInTheDocument();
    expect(onUploadSuccess).not.toHaveBeenCalled();
  });

  it('hủy_calls_onClose', async () => {
    const user = userEvent.setup();
    render(
      <UploadDocModal isOpen onClose={onClose} onUploadSuccess={onUploadSuccess} categories={CATEGORIES} />
    );
    await screen.findByRole('heading', { name: /Tải lên tài liệu mới/ });
    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('submit_disabled_when_no_file', async () => {
    render(
      <UploadDocModal isOpen onClose={onClose} onUploadSuccess={onUploadSuccess} categories={CATEGORIES} />
    );
    await screen.findByRole('heading', { name: /Tải lên tài liệu mới/ });
    expect(screen.getByRole('button', { name: /Bắt đầu tải lên/ })).toBeDisabled();
  });
});
