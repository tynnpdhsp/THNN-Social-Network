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

const SAMPLE_ITEMS = [
  { id: 'p-cheap', title: 'Cheap Supply', category_id: 'supplies', price: 10000, avg_rating: 3, rating_count: 0, images: [], description: 'd' },
  { id: 'p-doc', title: 'Alpha Doc', category_id: 'docs', price: 100000, avg_rating: 4, rating_count: 2, images: [], description: 'd' },
];

const CART_LINE = {
  item_id: 'line-1',
  quantity: 1,
  item: { id: 'p-cheap', title: 'Cheap Supply', price: 10000, images: [] },
};

function setupCategoriesAndProducts() {
  hoisted.getCategories.mockResolvedValue([{ id: 'docs', name: 'Tài liệu' }]);
  hoisted.getItems.mockResolvedValue({ items: [...SAMPLE_ITEMS] });
}

function cardByProductTitle(title) {
  const h = screen.getByText(title);
  return h.closest('.pin-card');
}

describe('Shop — cart & checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(hoisted).forEach((fn) => {
      if (typeof fn?.mockReset === 'function') fn.mockReset();
    });
    setupCategoriesAndProducts();
    hoisted.addToCart.mockResolvedValue({});
    hoisted.updateCartItem.mockResolvedValue({});
    hoisted.removeFromCart.mockResolvedValue({});
    hoisted.createOrder.mockResolvedValue({ id: 'order-1' });
    hoisted.createVNPayUrl.mockResolvedValue({ payment_url: 'https://vnpay.example/pay' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mount_calls_getCategories_getItems_getCart', async () => {
    hoisted.getCart.mockResolvedValue({ items: [] });
    render(<Shop />);
    await waitFor(() => {
      expect(hoisted.getCategories).toHaveBeenCalled();
      expect(hoisted.getItems).toHaveBeenCalledWith({ limit: 100 });
      expect(hoisted.getCart).toHaveBeenCalled();
    });
  });

  it('handleAddToCart_calls_addToCart_with_product_id_then_fetchCart', async () => {
    const user = userEvent.setup();
    let cartItems = [];
    hoisted.getCart.mockImplementation(() => Promise.resolve({ items: [...cartItems] }));
    hoisted.addToCart.mockImplementation(async (itemId, qty) => {
      expect(itemId).toBe('p-cheap');
      expect(qty).toBe(1);
      cartItems = [{ ...CART_LINE }];
      return {};
    });

    render(<Shop />);
    await screen.findByText('Cheap Supply');
    const card = cardByProductTitle('Cheap Supply');
    const buttons = within(card).getAllByRole('button');
    await user.click(buttons[2]);

    await waitFor(() => {
      expect(hoisted.addToCart).toHaveBeenCalledWith('p-cheap', 1);
      expect(hoisted.getCart.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(hoisted.toastSuccess).toHaveBeenCalled();
  });

  it('handleAddToCart_failure_shows_toast_with_message', async () => {
    const user = userEvent.setup();
    hoisted.getCart.mockResolvedValue({ items: [] });
    hoisted.addToCart.mockRejectedValueOnce(new Error('out of stock'));

    render(<Shop />);
    await screen.findByText('Cheap Supply');
    const card = cardByProductTitle('Cheap Supply');
    await user.click(within(card).getAllByRole('button')[2]);

    await waitFor(() =>
      expect(hoisted.toastError).toHaveBeenCalledWith('Lỗi khi thêm vào giỏ hàng: out of stock')
    );
  });

  it('cart_drawer_update_quantity_calls_updateCartItem_and_refetches', async () => {
    const user = userEvent.setup();
    hoisted.getCart.mockResolvedValue({ items: [{ ...CART_LINE, quantity: 1 }] });

    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(document.querySelector('.cart-icon-floating'));
    await screen.findByText('Giỏ hàng của bạn');

    const drawer = document.querySelector('.cart-drawer-content');
    const qc = drawer.querySelector('.quantity-controls');
    const [, plusBtn] = within(qc).getAllByRole('button');
    await user.click(plusBtn);

    await waitFor(() => {
      expect(hoisted.updateCartItem).toHaveBeenCalledWith('line-1', 2);
      expect(hoisted.getCart.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('cart_drawer_remove_calls_removeFromCart_and_refetches', async () => {
    const user = userEvent.setup();
    hoisted.getCart.mockResolvedValue({ items: [{ ...CART_LINE }] });

    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(document.querySelector('.cart-icon-floating'));
    await screen.findByText('Giỏ hàng của bạn');

    const removeBtn = document.querySelector('.remove-btn');
    expect(removeBtn).toBeTruthy();
    await user.click(removeBtn);

    await waitFor(() => {
      expect(hoisted.removeFromCart).toHaveBeenCalledWith('line-1');
      expect(hoisted.getCart.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(hoisted.toastSuccess).toHaveBeenCalledWith('Đã xóa khỏi giỏ hàng');
  });

  it('updateCartItem_failure_shows_toast', async () => {
    const user = userEvent.setup();
    hoisted.getCart.mockResolvedValue({ items: [{ ...CART_LINE }] });
    hoisted.updateCartItem.mockRejectedValueOnce(new Error('fail'));

    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(document.querySelector('.cart-icon-floating'));
    await screen.findByText('Giỏ hàng của bạn');

    const drawer = document.querySelector('.cart-drawer-content');
    const qc = drawer.querySelector('.quantity-controls');
    const [, plusBtn] = within(qc).getAllByRole('button');
    await user.click(plusBtn);

    await waitFor(() => expect(hoisted.toastError).toHaveBeenCalledWith('Lỗi khi cập nhật số lượng'));
  });

  it('removeFromCart_failure_shows_toast', async () => {
    const user = userEvent.setup();
    hoisted.getCart.mockResolvedValue({ items: [{ ...CART_LINE }] });
    hoisted.removeFromCart.mockRejectedValueOnce(new Error('fail'));

    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(document.querySelector('.cart-icon-floating'));
    await screen.findByText('Giỏ hàng của bạn');
    await user.click(document.querySelector('.remove-btn'));

    await waitFor(() => expect(hoisted.toastError).toHaveBeenCalledWith('Lỗi khi xóa sản phẩm'));
  });

  it('empty_cart_drawer_does_not_render_checkout_button', async () => {
    const user = userEvent.setup();
    hoisted.getCart.mockResolvedValue({ items: [] });

    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(document.querySelector('.cart-icon-floating'));
    await screen.findByText('Giỏ hàng đang trống');

    expect(screen.queryByRole('button', { name: /Thanh toán ngay/ })).not.toBeInTheDocument();
  });

  it('handleCartCheckout_calls_createOrder_and_vnpay_then_redirect_after_1s', async () => {
    const user = userEvent.setup();
    let href = 'http://localhost/';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return href;
        },
        set href(v) {
          href = v;
        },
        pathname: '/',
        assign: vi.fn(),
        replace: vi.fn(),
        reload: vi.fn(),
      },
    });

    hoisted.getCart.mockResolvedValue({ items: [{ ...CART_LINE }] });

    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(document.querySelector('.cart-icon-floating'));
    await screen.findByRole('button', { name: /Thanh toán ngay/ });

    const origSetTimeout = globalThis.setTimeout.bind(globalThis);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, ms, ...args) => {
      if (ms === 1000 && typeof fn === 'function') {
        fn();
        return 0;
      }
      return origSetTimeout(fn, ms, ...args);
    });
    try {
      fireEvent.click(screen.getByRole('button', { name: /Thanh toán ngay/ }));

      await waitFor(
        () => {
          expect(hoisted.createOrder).toHaveBeenCalledWith({
            item_id: 'p-cheap',
            amount: 10000,
            payment_method: 'vnpay',
          });
          expect(hoisted.createVNPayUrl).toHaveBeenCalledWith({
            order_id: 'order-1',
            ip_addr: '127.0.0.1',
            order_type: 'billpayment',
          });
        },
        { timeout: 3000 }
      );

      expect(hoisted.toastLoading).toHaveBeenCalled();
      expect(href).toBe('https://vnpay.example/pay');
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it('buyNow_from_product_card_same_payment_flow', async () => {
    const user = userEvent.setup();
    let href = 'http://localhost/';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return href;
        },
        set href(v) {
          href = v;
        },
        pathname: '/',
        assign: vi.fn(),
        replace: vi.fn(),
        reload: vi.fn(),
      },
    });

    hoisted.getCart.mockResolvedValue({ items: [] });

    render(<Shop />);
    await screen.findByText('Cheap Supply');
    const card = cardByProductTitle('Cheap Supply');

    const origSetTimeout = globalThis.setTimeout.bind(globalThis);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, ms, ...args) => {
      if (ms === 1000 && typeof fn === 'function') {
        fn();
        return 0;
      }
      return origSetTimeout(fn, ms, ...args);
    });
    try {
      fireEvent.click(within(card).getByRole('button', { name: 'Mua ngay' }));

      await waitFor(() => expect(hoisted.createOrder).toHaveBeenCalled(), { timeout: 3000 });
      expect(href).toBe('https://vnpay.example/pay');
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it('buyNow_missing_payment_url_throws_and_shows_toast_error', async () => {
    const user = userEvent.setup();
    hoisted.getCart.mockResolvedValue({ items: [] });
    hoisted.createVNPayUrl.mockResolvedValueOnce({});

    render(<Shop />);
    await screen.findByText('Cheap Supply');
    const card = cardByProductTitle('Cheap Supply');
    await user.click(within(card).getByRole('button', { name: 'Mua ngay' }));

    await waitFor(() =>
      expect(hoisted.toastError).toHaveBeenCalledWith(
        expect.stringContaining('Lỗi khi thanh toán:')
      )
    );
  });

  it('buyNow_createOrder_rejection_shows_toast', async () => {
    const user = userEvent.setup();
    hoisted.getCart.mockResolvedValue({ items: [] });
    hoisted.createOrder.mockRejectedValueOnce(new Error('denied'));

    render(<Shop />);
    await screen.findByText('Cheap Supply');
    await user.click(within(cardByProductTitle('Cheap Supply')).getByRole('button', { name: 'Mua ngay' }));

    await waitFor(() =>
      expect(hoisted.toastError).toHaveBeenCalledWith('Lỗi khi thanh toán: denied')
    );
  });
});
