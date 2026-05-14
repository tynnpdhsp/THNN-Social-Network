import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const hoistedToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...a) => hoistedToast.success(...a),
    error: (...a) => hoistedToast.error(...a),
    loading: (...a) => hoistedToast.loading(...a),
  },
}));

import AddProductModal from '@/components/Shop/AddProductModal.jsx';

const CATEGORIES = [
  { id: 'c1', name: 'Danh mục 1' },
  { id: 'c2', name: 'Danh mục 2' },
];

describe('AddProductModal', () => {
  const onClose = vi.fn();
  const onAdd = vi.fn();
  let origRaf;

  beforeEach(() => {
    origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };
    vi.clearAllMocks();
    onAdd.mockResolvedValue(undefined);
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf;
  });

  it('isOpen_false_renders_no_dialog_content', () => {
    render(
      <AddProductModal isOpen={false} onClose={onClose} onAdd={onAdd} categories={CATEGORIES} productToEdit={null} />
    );
    expect(screen.queryByRole('heading', { name: /Đăng bán vật phẩm mới/ })).not.toBeInTheDocument();
  });

  it('create_mode_shows_empty_form_and_default_first_category', async () => {
    render(
      <AddProductModal isOpen onClose={onClose} onAdd={onAdd} categories={CATEGORIES} productToEdit={null} />
    );
    expect(await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ví dụ: Giáo trình/)).toHaveValue('');
    expect(screen.getByPlaceholderText('0')).toHaveValue('');
    expect(screen.getByText('Danh mục 1')).toBeInTheDocument();
  });

  it('edit_mode_preloads_title_price_description_and_hides_image_dropzone', async () => {
    const product = {
      id: 'p1',
      title: 'Old title',
      price: 1234567,
      category_id: 'c2',
      description: 'Long text',
    };
    render(
      <AddProductModal isOpen onClose={onClose} onAdd={onAdd} categories={CATEGORIES} productToEdit={product} />
    );
    expect(await screen.findByRole('heading', { name: /Cập nhật vật phẩm/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ví dụ: Giáo trình/)).toHaveValue('Old title');
    expect(screen.getByPlaceholderText('0')).toHaveValue('1.234.567');
    expect(screen.getByText('Danh mục 2')).toBeInTheDocument();
    expect(screen.queryByText(/Tải lên hình ảnh/)).not.toBeInTheDocument();
  });

  it('handlePriceChange_strips_non_digits', async () => {
    const user = userEvent.setup();
    render(
      <AddProductModal isOpen onClose={onClose} onAdd={onAdd} categories={CATEGORIES} productToEdit={null} />
    );
    await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ });
    const price = screen.getByPlaceholderText('0');
    await user.type(price, '12a34b');
    expect(price).toHaveValue('1.234');
  });

  it('submit_with_title_and_price_calls_onAdd_then_onClose', async () => {
    const user = userEvent.setup();
    render(
      <AddProductModal isOpen onClose={onClose} onAdd={onAdd} categories={CATEGORIES} productToEdit={null} />
    );
    await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ });
    await user.type(screen.getByPlaceholderText(/Ví dụ: Giáo trình/), 'Item A');
    await user.type(screen.getByPlaceholderText('0'), '99000');
    await user.click(screen.getByRole('button', { name: /Đăng bán ngay/ }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Item A',
          price: '99000',
          category: 'c1',
        }),
        []
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('submit_missing_title_does_not_call_onAdd', async () => {
    const user = userEvent.setup();
    render(
      <AddProductModal isOpen onClose={onClose} onAdd={onAdd} categories={CATEGORIES} productToEdit={null} />
    );
    await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ });
    await user.type(screen.getByPlaceholderText('0'), '1000');
    fireEvent.submit(screen.getByPlaceholderText('0').closest('form'));
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('submit_missing_price_does_not_call_onAdd', async () => {
    const user = userEvent.setup();
    render(
      <AddProductModal isOpen onClose={onClose} onAdd={onAdd} categories={CATEGORIES} productToEdit={null} />
    );
    await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ });
    await user.type(screen.getByPlaceholderText(/Ví dụ: Giáo trình/), 'T only');
    fireEvent.submit(screen.getByPlaceholderText(/Ví dụ: Giáo trình/).closest('form'));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('onAdd_rejection_shows_toast_and_re_enables_submit', async () => {
    const user = userEvent.setup();
    onAdd.mockRejectedValueOnce(new Error('server down'));
    render(
      <AddProductModal isOpen onClose={onClose} onAdd={onAdd} categories={CATEGORIES} productToEdit={null} />
    );
    await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ });
    await user.type(screen.getByPlaceholderText(/Ví dụ: Giáo trình/), 'X');
    await user.type(screen.getByPlaceholderText('0'), '1');
    await user.click(screen.getByRole('button', { name: /Đăng bán ngay/ }));

    await waitFor(() => expect(hoistedToast.error).toHaveBeenCalledWith('Lỗi: server down'));
    expect(screen.getByRole('button', { name: /Đăng bán ngay/ })).not.toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handleImageChange_shows_selected_count', async () => {
    const user = userEvent.setup();
    render(
      <AddProductModal isOpen onClose={onClose} onAdd={onAdd} categories={CATEGORIES} productToEdit={null} />
    );
    await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ });
    const input = document.querySelector('input[type="file"][accept="image/*"]');
    const f1 = new File(['a'], 'a.png', { type: 'image/png' });
    const f2 = new File(['b'], 'b.png', { type: 'image/png' });
    await user.upload(input, [f1, f2]);
    expect(screen.getByText('Đã chọn 2 ảnh')).toBeInTheDocument();
  });

  it('category_dropdown_selects_second_category', async () => {
    const user = userEvent.setup();
    render(
      <AddProductModal isOpen onClose={onClose} onAdd={onAdd} categories={CATEGORIES} productToEdit={null} />
    );
    await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ });
    await user.click(screen.getByRole('button', { name: 'Danh mục 1' }));
    await user.click(screen.getByText('Danh mục 2'));
    await user.type(screen.getByPlaceholderText(/Ví dụ: Giáo trình/), 'Cat2');
    await user.type(screen.getByPlaceholderText('0'), '1000');
    await user.click(screen.getByRole('button', { name: /Đăng bán ngay/ }));

    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cat2', category: 'c2' }), [])
    );
  });

  it('cancel_button_calls_onClose', async () => {
    const user = userEvent.setup();
    render(
      <AddProductModal isOpen onClose={onClose} onAdd={onAdd} categories={CATEGORIES} productToEdit={null} />
    );
    await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ });
    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onClose).toHaveBeenCalled();
  });
});
