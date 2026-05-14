import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const hoisted = vi.hoisted(() => ({
  getDocumentCategories: vi.fn(),
  getDocuments: vi.fn(),
  deleteDocument: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/services/documentService.js', () => ({
  getDocumentCategories: (...a) => hoisted.getDocumentCategories(...a),
  getDocuments: (...a) => hoisted.getDocuments(...a),
  deleteDocument: (...a) => hoisted.deleteDocument(...a),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...a) => hoisted.toastSuccess(...a),
    error: (...a) => hoisted.toastError(...a),
    loading: vi.fn(),
  },
}));

import StudyDocs from '@/components/StudyDocs/StudyDocs.jsx';

const DOCS = [
  {
    id: 'd1',
    title: 'Doc Alpha',
    file_size: 0,
    file_url: 'https://cdn.example/files/a.pdf',
    created_at: '2024-06-15T12:00:00.000Z',
    avg_rating: 4.5,
    category: { name: 'Toán' },
    user_info: { full_name: 'Người A' },
  },
  {
    id: 'd2',
    title: 'Doc Beta',
    file_size: 2048,
    file_url: '/static/b.pdf',
    created_at: '2024-07-20T08:30:00.000Z',
    avg_rating: 3,
    category: { name: 'Văn' },
    user_info: null,
  },
  {
    id: 'd3',
    title: 'Doc Gamma',
    file_size: 1536 * 1024,
    file_url: 'https://x/c.pdf',
    created_at: '2023-01-01T00:00:00.000Z',
    avg_rating: 5,
    category: { name: 'Anh' },
    user_info: { full_name: 'B' },
  },
];

function setupDefaultMocks() {
  hoisted.getDocumentCategories.mockResolvedValue([
    { id: 'c1', name: 'Toán' },
    { id: 'c2', name: 'Văn' },
  ]);
  hoisted.getDocuments.mockResolvedValue({ items: DOCS, total: 3 });
  hoisted.deleteDocument.mockResolvedValue({});
}

describe('StudyDocs', () => {
  let writeTextSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(hoisted).forEach((fn) => {
      if (typeof fn?.mockReset === 'function') fn.mockReset();
    });
    setupDefaultMocks();
    writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  });

  afterEach(() => {
    writeTextSpy.mockRestore();
  });

  it('fetchCategories_prepends_all_before_api_categories', async () => {
    const user = userEvent.setup();
    render(<StudyDocs />);
    await waitFor(() => expect(hoisted.getDocumentCategories).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /Tất cả/ }));
    const menu = screen.getByRole('button', { name: /Tất cả/ }).nextElementSibling;
    expect(menu).toBeTruthy();
    expect(within(menu).getByText('Tất cả')).toBeInTheDocument();
    expect(within(menu).getByText('Toán')).toBeInTheDocument();
    expect(within(menu).getByText('Văn')).toBeInTheDocument();
  });

  it('mount_getDocuments_default_params_without_category_id', async () => {
    render(<StudyDocs />);
    await waitFor(() =>
      expect(hoisted.getDocuments).toHaveBeenCalledWith({
        sort: 'newest',
        limit: 5,
        skip: 0,
      })
    );
  });

  it('filter_category_sets_category_id_and_resets_skip', async () => {
    const user = userEvent.setup();
    hoisted.getDocuments.mockResolvedValue({ items: DOCS, total: 12 });
    render(<StudyDocs />);
    await screen.findByText('Doc Alpha');
    hoisted.getDocuments.mockClear();

    await user.click(screen.getByRole('button', { name: /Tất cả/ }));
    const menu = screen.getByRole('button', { name: /Tất cả/ }).nextElementSibling;
    await user.click(within(menu).getByText('Toán'));
    await waitFor(() =>
      expect(hoisted.getDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          category_id: 'c1',
          skip: 0,
          sort: 'newest',
          limit: 5,
        })
      )
    );
  });

  it('pagination_page2_uses_skip_5', async () => {
    const user = userEvent.setup();
    hoisted.getDocuments.mockResolvedValue({ items: DOCS, total: 12 });
    render(<StudyDocs />);
    await screen.findByText('Doc Alpha');
    hoisted.getDocuments.mockClear();
    const next = [...document.querySelectorAll('button.btn-secondary')].find((b) =>
      b.querySelector('svg.lucide-chevron-right')
    );
    expect(next).toBeTruthy();
    await user.click(next);
    await waitFor(() =>
      expect(hoisted.getDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, limit: 5 })
      )
    );
  });

  it('changing_sort_after_page2_resets_skip_to_0', async () => {
    const user = userEvent.setup();
    hoisted.getDocuments.mockResolvedValue({ items: DOCS, total: 12 });
    render(<StudyDocs />);
    await screen.findByText('Doc Alpha');
    const next = [...document.querySelectorAll('button.btn-secondary')].find((b) =>
      b.querySelector('svg.lucide-chevron-right')
    );
    await user.click(next);
    await waitFor(() => expect(hoisted.getDocuments).toHaveBeenCalledWith(expect.objectContaining({ skip: 5 })));
    hoisted.getDocuments.mockClear();
    await user.click(screen.getByRole('button', { name: /Mới nhất/ }));
    await user.click(screen.getByText('Đánh giá cao'));
    await waitFor(() =>
      expect(hoisted.getDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: 'rating',
          skip: 0,
        })
      )
    );
  });

  it('formatFileSize_table_shows_zero_bytes_two_kb_one_point_five_mb', async () => {
    render(<StudyDocs />);
    await screen.findByText('Doc Alpha');
    expect(screen.getByText(/0 Bytes/)).toBeInTheDocument();
    expect(screen.getByText(/2 KB/)).toBeInTheDocument();
    expect(screen.getByText(/1\.5 MB/)).toBeInTheDocument();
  });

  it('formatDate_table_shows_vi_locale', async () => {
    render(<StudyDocs />);
    await screen.findByText('Doc Alpha');
    const expected = new Date('2024-06-15T12:00:00.000Z').toLocaleDateString('vi-VN');
    expect(screen.getAllByText(expected).length).toBeGreaterThanOrEqual(1);
  });

  it('handleShare_http_url_copies_as_is', async () => {
    const user = userEvent.setup();
    render(<StudyDocs />);
    await screen.findByText('Doc Alpha');
    const row = screen.getByText('Doc Alpha').closest('tr');
    await user.click(within(row).getByTitle('Chia sẻ'));
    await waitFor(() =>
      expect(writeTextSpy).toHaveBeenCalledWith('https://cdn.example/files/a.pdf')
    );
    expect(hoisted.toastSuccess).toHaveBeenCalledWith('Đã sao chép liên kết tải tài liệu!');
  });

  it('handleShare_relative_url_prefixes_window_origin', async () => {
    const user = userEvent.setup();
    render(<StudyDocs />);
    await screen.findByText('Doc Beta');
    const row = screen.getByText('Doc Beta').closest('tr');
    await user.click(within(row).getByTitle('Chia sẻ'));
    const origin = window.location.origin;
    await waitFor(() => expect(writeTextSpy).toHaveBeenCalledWith(`${origin}/static/b.pdf`));
  });

  it('clipboard_failure_shows_error_toast', async () => {
    const user = userEvent.setup();
    writeTextSpy.mockRejectedValueOnce(new Error('denied'));
    render(<StudyDocs />);
    await screen.findByText('Doc Alpha');
    await user.click(within(screen.getByText('Doc Alpha').closest('tr')).getByTitle('Chia sẻ'));
    await waitFor(() => expect(hoisted.toastError).toHaveBeenCalledWith('Không thể sao chép liên kết'));
  });

  it('clicking_share_does_not_open_detail_modal', async () => {
    const user = userEvent.setup();
    render(<StudyDocs />);
    await screen.findByText('Doc Alpha');
    await user.click(within(screen.getByText('Doc Alpha').closest('tr')).getByTitle('Chia sẻ'));
    expect(screen.queryByRole('heading', { level: 2, name: 'Doc Alpha' })).not.toBeInTheDocument();
  });

  it('clicking_row_title_opens_detail_modal', async () => {
    const user = userEvent.setup();
    render(<StudyDocs />);
    await screen.findByText('Doc Alpha');
    await user.click(screen.getByText('Doc Alpha'));
    expect(await screen.findByRole('heading', { name: 'Doc Alpha' })).toBeInTheDocument();
  });

  it('upload_button_opens_UploadDocModal', async () => {
    const user = userEvent.setup();
    let origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };
    render(<StudyDocs />);
    await screen.findByText('Doc Alpha');
    await user.click(screen.getByRole('button', { name: /Tải lên tài liệu/ }));
    expect(await screen.findByRole('heading', { name: /Tải lên tài liệu mới/ })).toBeInTheDocument();
    globalThis.requestAnimationFrame = origRaf;
  });

  it('delete_from_menu_calls_deleteDocument_and_success_toast', async () => {
    const user = userEvent.setup();
    render(<StudyDocs />);
    await screen.findByText('Doc Alpha');
    const row = screen.getByText('Doc Alpha').closest('tr');
    const rowBtns = within(row).getAllByRole('button');
    fireEvent.click(rowBtns[rowBtns.length - 1]);
    await user.click(await screen.findByText(/Xoá tài liệu/));
    await user.click(screen.getByRole('button', { name: 'Xác nhận xoá' }));
    await waitFor(() => {
      expect(hoisted.deleteDocument).toHaveBeenCalledWith('d1');
      expect(hoisted.toastSuccess).toHaveBeenCalledWith('Đã xoá tài liệu thành công');
    });
  });

  it('deleteDocument_failure_shows_error_toast', async () => {
    const user = userEvent.setup();
    hoisted.deleteDocument.mockRejectedValueOnce(new Error('forbidden'));
    render(<StudyDocs />);
    await screen.findByText('Doc Alpha');
    const row = screen.getByText('Doc Alpha').closest('tr');
    const rowBtns = within(row).getAllByRole('button');
    fireEvent.click(rowBtns[rowBtns.length - 1]);
    await user.click(await screen.findByText(/Xoá tài liệu/));
    await user.click(screen.getByRole('button', { name: 'Xác nhận xoá' }));
    await waitFor(() =>
      expect(hoisted.toastError).toHaveBeenCalledWith('Lỗi khi xoá tài liệu: forbidden')
    );
  });
});
