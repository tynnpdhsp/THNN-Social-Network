import '../../_fakes/setupAuthMock.js';
import { mockUseAuth, defaultAuthMockValue } from '../../_fakes/setupAuthMock.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const hoisted = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getItems: vi.fn(),
  getCart: vi.fn(),
  addToCart: vi.fn(),
  updateCartItem: vi.fn(),
  removeFromCart: vi.fn(),
  createOrder: vi.fn(),
  createVNPayUrl: vi.fn(),
  updateItem: vi.fn(),
  createItem: vi.fn(),
  deleteItem: vi.fn(),
  uploadItemImages: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastLoading: vi.fn(),
}));

vi.mock('@/services/shopService.js', () => ({ ...hoisted }));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args) => hoisted.toastSuccess(...args),
    error: (...args) => hoisted.toastError(...args),
    loading: (...args) => hoisted.toastLoading(...args),
  },
}));

import Shop from '@/components/Shop/Shop.jsx';

const SHOP_OWNER_ID = 'u-test';

const SAMPLE_ITEMS = [
  {
    id: 'p-cheap',
    title: 'Cheap Supply',
    category_id: 'supplies',
    price: 10000,
    avg_rating: 3,
    rating_count: 0,
    images: [],
    description: 'd',
    seller_id: SHOP_OWNER_ID,
  },
  {
    id: 'p-doc',
    title: 'Alpha Doc',
    category_id: 'docs',
    price: 100000,
    avg_rating: 4,
    rating_count: 2,
    images: [],
    description: 'desc',
    seller_id: SHOP_OWNER_ID,
  },
];

function setupDefaults() {
  hoisted.getCategories.mockResolvedValue([
    { id: 'docs', name: 'Tài liệu' },
    { id: 'supplies', name: 'Vật dụng' },
  ]);
  hoisted.getItems.mockResolvedValue({ items: [...SAMPLE_ITEMS] });
  hoisted.getCart.mockResolvedValue({ items: [] });
  hoisted.createItem.mockResolvedValue({ id: 'new-1' });
  hoisted.updateItem.mockResolvedValue({});
  hoisted.deleteItem.mockResolvedValue({});
  hoisted.uploadItemImages.mockResolvedValue({ image_urls: ['https://img/u1.png'] });
}

function cardByProductTitle(title) {
  return screen.getByText(title).closest('.pin-card');
}

function editButtonInCard(card) {
  const buttons = within(card).getAllByRole('button');
  const deleteBtn = deleteButtonInCard(card);
  if (deleteBtn) {
    const deleteIdx = buttons.indexOf(deleteBtn);
    if (deleteIdx > 0) return buttons[deleteIdx - 1];
  }
  return buttons.find((b) => {
    const svg = b.querySelector('svg');
    if (!svg) return false;
    const cls = svg.getAttribute('class') || '';
    return (
      cls.includes('lucide-') &&
      !cls.includes('trash') &&
      !cls.includes('shopping-bag')
    );
  });
}

function deleteButtonInCard(card) {
  return within(card)
    .getAllByRole('button')
    .find((b) => b.querySelector('svg.lucide-trash, svg.lucide-trash-2'));
}

describe('Shop — product CRUD', () => {
  let origRaf;

  beforeEach(() => {
    origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };
    vi.clearAllMocks();
    Object.values(hoisted).forEach((fn) => {
      if (typeof fn?.mockReset === 'function') fn.mockReset();
    });
    setupDefaults();
    mockUseAuth.mockReturnValue(
      defaultAuthMockValue({
        user: {
          id: SHOP_OWNER_ID,
          full_name: 'Test User',
          avatar_url: null,
          role: 'student',
        },
      }),
    );
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf;
    vi.useRealTimers();
  });

  it('open_add_modal_from_sidebar_then_createItem_without_images', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(screen.getByRole('button', { name: /Đăng bán vật phẩm/ }));

    expect(await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Ví dụ: Giáo trình/), 'New Pen');
    const priceInput = screen.getByPlaceholderText('0');
    await user.clear(priceInput);
    await user.type(priceInput, '50000');

    await user.click(screen.getByRole('button', { name: /Đăng bán ngay/ }));

    await waitFor(() => {
      expect(hoisted.uploadItemImages).not.toHaveBeenCalled();
      expect(hoisted.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Pen',
          price: 50000,
          category_id: 'docs',
          image_urls: [],
          condition: 'new',
          stock: 1,
        })
      );
    });
    expect(hoisted.toastSuccess).toHaveBeenCalledWith('Đăng bán thành công');
    expect(hoisted.getItems.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('create_with_images_calls_upload_then_createItem_with_urls', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(screen.getByRole('button', { name: /Đăng bán vật phẩm/ }));
    await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ });

    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const hiddenInput = document.querySelector('input[type="file"][accept="image/*"]');
    expect(hiddenInput).toBeTruthy();
    await user.upload(hiddenInput, file);

    await user.type(screen.getByPlaceholderText(/Ví dụ: Giáo trình/), 'Photo item');
    await user.clear(screen.getByPlaceholderText('0'));
    await user.type(screen.getByPlaceholderText('0'), '120000');
    await user.click(screen.getByRole('button', { name: /Đăng bán ngay/ }));

    await waitFor(() => {
      expect(hoisted.uploadItemImages).toHaveBeenCalled();
      const files = hoisted.uploadItemImages.mock.calls[0][0];
      expect(files[0]).toBeInstanceOf(File);
      expect(hoisted.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Photo item',
          price: 120000,
          image_urls: ['https://img/u1.png'],
        })
      );
    });
  });

  it('edit_mode_calls_updateItem_with_three_fields_only', async () => {
    const user = userEvent.setup({ pointerEventsCheck: false });
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    const card = cardByProductTitle('Alpha Doc');
    const overlay = card.querySelector('.overlay');
    if (overlay) await user.hover(overlay);
    const editBtn = editButtonInCard(card);
    expect(editBtn).toBeTruthy();
    await user.click(editBtn);

    expect(await screen.findByRole('heading', { name: /Cập nhật vật phẩm/ })).toBeInTheDocument();
    expect(screen.queryByText(/Tải lên hình ảnh/)).not.toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/Ví dụ: Giáo trình/);
    await user.clear(titleInput);
    await user.type(titleInput, 'Alpha Doc v2');
    await user.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));

    await waitFor(() => {
      expect(hoisted.updateItem).toHaveBeenCalledWith('p-doc', {
        title: 'Alpha Doc v2',
        price: 100000,
        description: 'desc',
      });
      expect(hoisted.createItem).not.toHaveBeenCalled();
      expect(hoisted.uploadItemImages).not.toHaveBeenCalled();
    });
    expect(hoisted.toastSuccess).toHaveBeenCalledWith('Cập nhật thành công');
  });

  it('confirmDelete_calls_deleteItem_then_refetch', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(deleteButtonInCard(cardByProductTitle('Cheap Supply')));

    await screen.findByRole('heading', { name: 'Xác nhận xoá' });
    expect(screen.getAllByText(/Cheap Supply/).length).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByRole('button', { name: 'Xác nhận xoá' }));

    await waitFor(() => {
      expect(hoisted.deleteItem).toHaveBeenCalledWith('p-cheap');
      expect(hoisted.getItems.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(hoisted.toastSuccess).toHaveBeenCalledWith('Đã xoá vật phẩm');
  });

  it('confirmDelete_deleteItem_failure_shows_toast', async () => {
    const user = userEvent.setup();
    hoisted.deleteItem.mockRejectedValueOnce(new Error('forbidden'));

    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(deleteButtonInCard(cardByProductTitle('Cheap Supply')));
    await screen.findByRole('heading', { name: 'Xác nhận xoá' });
    await user.click(screen.getByRole('button', { name: 'Xác nhận xoá' }));

    await waitFor(() =>
      expect(hoisted.toastError).toHaveBeenCalledWith('Lỗi xoá vật phẩm: forbidden')
    );
  });

  it('addProduct_createItem_failure_shows_toast_and_propagates_to_modal', async () => {
    const user = userEvent.setup();
    hoisted.createItem.mockRejectedValueOnce(new Error('bad payload'));

    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(screen.getByRole('button', { name: /Đăng bán vật phẩm/ }));
    await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ });

    await user.type(screen.getByPlaceholderText(/Ví dụ: Giáo trình/), 'X');
    await user.type(screen.getByPlaceholderText('0'), '1000');
    await user.click(screen.getByRole('button', { name: /Đăng bán ngay/ }));

    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalledWith('Lỗi: bad payload');
    });
  });

  it('submit_add_modal_without_title_does_not_call_createItem', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(screen.getByRole('button', { name: /Đăng bán vật phẩm/ }));
    await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ });

    await user.type(screen.getByPlaceholderText('0'), '1000');
    const form = screen.getByPlaceholderText('0').closest('form');
    fireEvent.submit(form);

    expect(hoisted.createItem).not.toHaveBeenCalled();
  });

  it('submit_add_modal_without_price_does_not_call_createItem', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(screen.getByRole('button', { name: /Đăng bán vật phẩm/ }));
    await screen.findByRole('heading', { name: /Đăng bán vật phẩm mới/ });

    await user.type(screen.getByPlaceholderText(/Ví dụ: Giáo trình/), 'Only title');
    const form = screen.getByPlaceholderText(/Ví dụ: Giáo trình/).closest('form');
    fireEvent.submit(form);

    expect(hoisted.createItem).not.toHaveBeenCalled();
  });
});
