import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const hoisted = vi.hoisted(() => ({
  getDocumentReviews: vi.fn(),
  createDocumentReview: vi.fn(),
  getDocumentById: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/services/documentService.js', () => ({
  getDocumentReviews: (...a) => hoisted.getDocumentReviews(...a),
  createDocumentReview: (...a) => hoisted.createDocumentReview(...a),
  getDocumentById: (...a) => hoisted.getDocumentById(...a),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...a) => hoisted.toastSuccess(...a),
    error: (...a) => hoisted.toastError(...a),
  },
}));

import DocDetailModal from '@/components/StudyDocs/DocDetailModal.jsx';

const DOC = {
  id: 'doc-1',
  title: 'Tài liệu A',
  description: 'Mô tả ngắn',
  file_name: 'a.pdf',
  file_size: undefined,
  file_url: '/f.pdf',
  created_at: '2024-03-01T00:00:00.000Z',
  avg_rating: 3.25,
  category: { name: 'Lớp' },
  user_info: { full_name: 'Tác giả' },
};

describe('DocDetailModal', () => {
  const onClose = vi.fn();
  const onUpdateDoc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.getDocumentReviews.mockResolvedValue({ items: [] });
    hoisted.createDocumentReview.mockResolvedValue({});
    hoisted.getDocumentById.mockResolvedValue({ ...DOC, avg_rating: 4 });
  });

  it('isOpen_false_returns_null', () => {
    const { container } = render(
      <DocDetailModal isOpen={false} onClose={onClose} doc={DOC} onUpdateDoc={onUpdateDoc} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('open_with_doc_id_fetches_reviews', async () => {
    render(<DocDetailModal isOpen onClose={onClose} doc={DOC} onUpdateDoc={onUpdateDoc} />);
    await waitFor(() => expect(hoisted.getDocumentReviews).toHaveBeenCalledWith('doc-1'));
    expect(await screen.findByRole('heading', { name: 'Tài liệu A' })).toBeInTheDocument();
  });

  it('no_fetch_when_doc_has_no_id', () => {
    render(<DocDetailModal isOpen onClose={onClose} doc={{ title: 'X' }} onUpdateDoc={onUpdateDoc} />);
    expect(hoisted.getDocumentReviews).not.toHaveBeenCalled();
  });

  it('formatFileSize_undefined_shows_zero_bytes', async () => {
    render(<DocDetailModal isOpen onClose={onClose} doc={DOC} onUpdateDoc={onUpdateDoc} />);
    await screen.findByText(/Tệp đính kèm:/);
    expect(screen.getByText('0 Bytes')).toBeInTheDocument();
  });

  it('empty_comment_submit_disabled_and_does_not_call_create', async () => {
    const user = userEvent.setup();
    render(<DocDetailModal isOpen onClose={onClose} doc={DOC} onUpdateDoc={onUpdateDoc} />);
    await screen.findByRole('heading', { name: 'Tài liệu A' });
    const form = screen.getByPlaceholderText(/Để lại bình luận/).closest('form');
    fireEvent.submit(form);
    expect(hoisted.createDocumentReview).not.toHaveBeenCalled();
    const submitBtn = form.querySelector('button[type="submit"]');
    expect(submitBtn).toBeDisabled();
    await user.click(submitBtn);
    expect(hoisted.createDocumentReview).not.toHaveBeenCalled();
  });

  it('successful_review_calls_apis_toast_and_onUpdateDoc', async () => {
    const user = userEvent.setup();
    render(<DocDetailModal isOpen onClose={onClose} doc={DOC} onUpdateDoc={onUpdateDoc} />);
    await screen.findByRole('heading', { name: 'Tài liệu A' });
    await user.type(screen.getByPlaceholderText(/Để lại bình luận/), 'Hay');
    const submitBtn = screen.getByPlaceholderText(/Để lại bình luận/).closest('form').querySelector('button[type="submit"]');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(hoisted.createDocumentReview).toHaveBeenCalledWith('doc-1', { rating: 5, comment: 'Hay' });
      expect(hoisted.getDocumentById).toHaveBeenCalledWith('doc-1');
      expect(onUpdateDoc).toHaveBeenCalledWith({ ...DOC, avg_rating: 4 });
      expect(hoisted.toastSuccess).toHaveBeenCalledWith('Gửi nhận xét thành công!');
    });
  });

  it('review_error_shows_toast_error', async () => {
    const user = userEvent.setup();
    hoisted.createDocumentReview.mockRejectedValueOnce(new Error('spam'));
    render(<DocDetailModal isOpen onClose={onClose} doc={DOC} onUpdateDoc={onUpdateDoc} />);
    await screen.findByRole('heading', { name: 'Tài liệu A' });
    await user.type(screen.getByPlaceholderText(/Để lại bình luận/), 'x');
    const submitBtn = screen.getByPlaceholderText(/Để lại bình luận/).closest('form').querySelector('button[type="submit"]');
    await user.click(submitBtn);
    await waitFor(() =>
      expect(hoisted.toastError).toHaveBeenCalledWith('Có lỗi xảy ra: spam')
    );
  });

  it('backdrop_click_calls_onClose', async () => {
    const user = userEvent.setup();
    const { container } = render(<DocDetailModal isOpen onClose={onClose} doc={DOC} onUpdateDoc={onUpdateDoc} />);
    await screen.findByRole('heading', { name: 'Tài liệu A' });
    await user.click(container.firstChild);
    expect(onClose).toHaveBeenCalled();
  });

  it('click_inner_panel_does_not_close', async () => {
    const user = userEvent.setup();
    render(<DocDetailModal isOpen onClose={onClose} doc={DOC} onUpdateDoc={onUpdateDoc} />);
    await screen.findByRole('heading', { name: 'Tài liệu A' });
    onClose.mockClear();
    await user.click(screen.getByText('Mô tả ngắn'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lists_reviews_from_api', async () => {
    hoisted.getDocumentReviews.mockResolvedValue({
      items: [
        {
          id: 'r1',
          rating: 4,
          comment: 'Ok',
          created_at: '2024-04-01T00:00:00.000Z',
          user_info: { full_name: 'U1', avatar_url: null },
        },
      ],
    });
    render(<DocDetailModal isOpen onClose={onClose} doc={DOC} onUpdateDoc={onUpdateDoc} />);
    expect(await screen.findByText('Ok')).toBeInTheDocument();
    expect(screen.getByText('U1')).toBeInTheDocument();
  });

  it('header_X_closes', async () => {
    const user = userEvent.setup();
    render(<DocDetailModal isOpen onClose={onClose} doc={DOC} onUpdateDoc={onUpdateDoc} />);
    await screen.findByRole('heading', { name: 'Tài liệu A' });
    const x = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-x'));
    await user.click(x);
    expect(onClose).toHaveBeenCalled();
  });
});
