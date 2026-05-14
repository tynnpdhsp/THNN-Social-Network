import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const hoisted = vi.hoisted(() => ({
  getReviews: vi.fn(),
  createReview: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/services/shopService.js', () => ({
  getReviews: (...a) => hoisted.getReviews(...a),
  createReview: (...a) => hoisted.createReview(...a),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...a) => hoisted.toastSuccess(...a),
    error: (...a) => hoisted.toastError(...a),
    loading: vi.fn(),
  },
}));

import ProductDetailModal from '@/components/Shop/ProductDetailModal.jsx';

const PRODUCT = {
  id: 'item-9',
  title: 'Sách X',
  price: 75000,
  avg_rating: 4.2,
  rating_count: 3,
  description: 'Mô tả',
  images: [],
  category: { name: 'Sách' },
};

function sendReviewButton() {
  return screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-send'));
}

describe('ProductDetailModal', () => {
  const onClose = vi.fn();
  const onBuyNow = vi.fn();
  const onAddToCart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.getReviews.mockResolvedValue({ items: [] });
    hoisted.createReview.mockResolvedValue({});
  });

  it('isOpen_false_renders_nothing', () => {
    const { container } = render(
      <ProductDetailModal isOpen={false} onClose={onClose} product={{}} onBuyNow={onBuyNow} onAddToCart={onAddToCart} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('when_open_with_product_id_fetches_reviews', async () => {
    const { container } = render(
      <ProductDetailModal isOpen onClose={onClose} product={PRODUCT} onBuyNow={onBuyNow} onAddToCart={onAddToCart} />
    );
    await waitFor(() => expect(hoisted.getReviews).toHaveBeenCalledWith('item-9'));
    expect(await screen.findByText('Sách X')).toBeInTheDocument();
    expect(container.firstChild).toBeTruthy();
  });

  it('does_not_fetch_when_product_has_no_id', () => {
    render(
      <ProductDetailModal
        isOpen
        onClose={onClose}
        product={{ title: 'Ghost' }}
        onBuyNow={onBuyNow}
        onAddToCart={onAddToCart}
      />
    );
    expect(hoisted.getReviews).not.toHaveBeenCalled();
  });

  it('empty_comment_send_button_disabled_and_createReview_not_called', async () => {
    render(
      <ProductDetailModal isOpen onClose={onClose} product={PRODUCT} onBuyNow={onBuyNow} onAddToCart={onAddToCart} />
    );
    await screen.findByText('Sách X');
    const send = sendReviewButton();
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(hoisted.createReview).not.toHaveBeenCalled();
  });

  it('successful_review_submit_calls_createReview_refetch_and_toast', async () => {
    const user = userEvent.setup();
    render(
      <ProductDetailModal isOpen onClose={onClose} product={PRODUCT} onBuyNow={onBuyNow} onAddToCart={onAddToCart} />
    );
    await screen.findByText('Sách X');
    await user.type(screen.getByPlaceholderText(/Để lại nhận xét/), 'Hay quá');
    await user.click(sendReviewButton());

    await waitFor(() => {
      expect(hoisted.createReview).toHaveBeenCalledWith(
        'item-9',
        expect.objectContaining({ comment: 'Hay quá', rating: 5 })
      );
      expect(hoisted.getReviews.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(hoisted.toastSuccess).toHaveBeenCalledWith('Cảm ơn bạn đã đánh giá!');
    });
  });

  it('createReview_error_must_purchase_shows_specific_toast', async () => {
    const user = userEvent.setup();
    hoisted.createReview.mockRejectedValueOnce(new Error('MUST_PURCHASE_FIRST'));

    render(
      <ProductDetailModal isOpen onClose={onClose} product={PRODUCT} onBuyNow={onBuyNow} onAddToCart={onAddToCart} />
    );
    await screen.findByText('Sách X');
    await user.type(screen.getByPlaceholderText(/Để lại nhận xét/), 'x');
    await user.click(sendReviewButton());

    await waitFor(() =>
      expect(hoisted.toastError).toHaveBeenCalledWith(
        'Bạn phải mua và thanh toán sản phẩm này mới có thể đánh giá!'
      )
    );
  });

  it('createReview_error_with_purchase_substring_shows_specific_toast', async () => {
    const user = userEvent.setup();
    hoisted.createReview.mockRejectedValueOnce(new Error('please purchase first'));

    render(
      <ProductDetailModal isOpen onClose={onClose} product={PRODUCT} onBuyNow={onBuyNow} onAddToCart={onAddToCart} />
    );
    await screen.findByText('Sách X');
    await user.type(screen.getByPlaceholderText(/Để lại nhận xét/), 'x');
    await user.click(sendReviewButton());

    await waitFor(() =>
      expect(hoisted.toastError).toHaveBeenCalledWith(
        'Bạn phải mua và thanh toán sản phẩm này mới có thể đánh giá!'
      )
    );
  });

  it('createReview_other_error_shows_generic_toast', async () => {
    const user = userEvent.setup();
    hoisted.createReview.mockRejectedValueOnce(new Error('rate limited'));

    render(
      <ProductDetailModal isOpen onClose={onClose} product={PRODUCT} onBuyNow={onBuyNow} onAddToCart={onAddToCart} />
    );
    await screen.findByText('Sách X');
    await user.type(screen.getByPlaceholderText(/Để lại nhận xét/), 'x');
    await user.click(sendReviewButton());

    await waitFor(() =>
      expect(hoisted.toastError).toHaveBeenCalledWith('Lỗi đăng nhận xét: rate limited')
    );
  });

  it('backdrop_mousedown_then_click_closes_modal', () => {
    const { container } = render(
      <ProductDetailModal isOpen onClose={onClose} product={PRODUCT} onBuyNow={onBuyNow} onAddToCart={onAddToCart} />
    );
    const backdrop = container.firstChild;
    fireEvent.mouseDown(backdrop, { target: backdrop, currentTarget: backdrop });
    fireEvent.click(backdrop, { target: backdrop, currentTarget: backdrop });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mousedown_on_panel_then_click_backdrop_does_not_close', () => {
    const { container } = render(
      <ProductDetailModal isOpen onClose={onClose} product={PRODUCT} onBuyNow={onBuyNow} onAddToCart={onAddToCart} />
    );
    const backdrop = container.firstChild;
    const panel = backdrop.firstElementChild;
    fireEvent.mouseDown(panel, { target: panel, currentTarget: backdrop });
    fireEvent.click(backdrop, { target: backdrop, currentTarget: backdrop });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('buy_now_and_add_to_cart_delegate', async () => {
    const user = userEvent.setup();
    render(
      <ProductDetailModal isOpen onClose={onClose} product={PRODUCT} onBuyNow={onBuyNow} onAddToCart={onAddToCart} />
    );
    await screen.findByText('Sách X');
    await user.click(screen.getByRole('button', { name: 'Mua ngay' }));
    expect(onBuyNow).toHaveBeenCalledWith(PRODUCT);
    const cartBtn = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-shopping-cart'));
    await user.click(cartBtn);
    expect(onAddToCart).toHaveBeenCalledWith(PRODUCT);
  });

  it('renders_reviews_from_api', async () => {
    hoisted.getReviews.mockResolvedValue({
      items: [
        {
          id: 'r1',
          rating: 5,
          comment: 'Tốt',
          created_at: '2024-01-02T00:00:00.000Z',
          user_info: { full_name: 'User A', avatar_url: null },
        },
      ],
    });
    render(
      <ProductDetailModal isOpen onClose={onClose} product={PRODUCT} onBuyNow={onBuyNow} onAddToCart={onAddToCart} />
    );
    expect(await screen.findByText('Tốt')).toBeInTheDocument();
    expect(screen.getByText('User A')).toBeInTheDocument();
  });

  it('close_X_button_calls_onClose', async () => {
    const user = userEvent.setup();
    render(
      <ProductDetailModal isOpen onClose={onClose} product={PRODUCT} onBuyNow={onBuyNow} onAddToCart={onAddToCart} />
    );
    await screen.findByText('Sách X');
    const xBtn = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-x'));
    await user.click(xBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
