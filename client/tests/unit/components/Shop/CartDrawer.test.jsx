import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import CartDrawer from '@/components/Shop/CartDrawer.jsx';

const ITEM = { id: 'i1', title: 'Notebook', price: 50000, images: [{ image_url: 'https://x/img.png' }] };

describe('CartDrawer', () => {
  const onClose = vi.fn();
  const onUpdateQuantity = vi.fn();
  const onRemoveItem = vi.fn();
  const onCheckout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isOpen_false_renders_nothing', () => {
    const { container } = render(
      <CartDrawer
        isOpen={false}
        onClose={onClose}
        cartItems={[]}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={onCheckout}
        isLoading={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('empty_cart_shows_message_and_continue_button_calls_onClose', async () => {
    const user = userEvent.setup();
    render(
      <CartDrawer
        isOpen
        onClose={onClose}
        cartItems={[]}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={onCheckout}
        isLoading={false}
      />
    );

    expect(screen.getByText('Giỏ hàng đang trống')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tiếp tục mua sắm' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('loading_shows_spinner_not_list', () => {
    render(
      <CartDrawer
        isOpen
        onClose={onClose}
        cartItems={[{ item_id: 'a', quantity: 1, item: ITEM }]}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={onCheckout}
        isLoading
      />
    );
    expect(document.querySelector('.cart-drawer-body .spin')).toBeTruthy();
    expect(screen.queryByText('Notebook')).not.toBeInTheDocument();
  });

  it('subtotal_sums_price_times_quantity', () => {
    render(
      <CartDrawer
        isOpen
        onClose={onClose}
        cartItems={[
          { item_id: 'a', quantity: 2, item: ITEM },
          { item_id: 'b', quantity: 1, item: { ...ITEM, id: 'i2', price: 10000 } },
        ]}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={onCheckout}
        isLoading={false}
      />
    );
    expect(screen.getAllByText('110.000đ').length).toBeGreaterThanOrEqual(1);
  });

  it('minus_disabled_at_quantity_1_plus_calls_onUpdateQuantity', async () => {
    const user = userEvent.setup();
    render(
      <CartDrawer
        isOpen
        onClose={onClose}
        cartItems={[{ item_id: 'line-1', quantity: 1, item: ITEM }]}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={onCheckout}
        isLoading={false}
      />
    );

    const qc = document.querySelector('.quantity-controls');
    const [minusBtn, plusBtn] = within(qc).getAllByRole('button');
    expect(minusBtn).toBeDisabled();
    await user.click(plusBtn);
    expect(onUpdateQuantity).toHaveBeenCalledWith('line-1', 2);
  });

  it('minus_at_quantity_2_calls_onUpdateQuantity_with_1', async () => {
    const user = userEvent.setup();
    render(
      <CartDrawer
        isOpen
        onClose={onClose}
        cartItems={[{ item_id: 'line-1', quantity: 2, item: ITEM }]}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={onCheckout}
        isLoading={false}
      />
    );
    const qc = document.querySelector('.quantity-controls');
    const [minusBtn] = within(qc).getAllByRole('button');
    expect(minusBtn).not.toBeDisabled();
    await user.click(minusBtn);
    expect(onUpdateQuantity).toHaveBeenCalledWith('line-1', 1);
  });

  it('remove_button_calls_onRemoveItem', async () => {
    const user = userEvent.setup();
    render(
      <CartDrawer
        isOpen
        onClose={onClose}
        cartItems={[{ item_id: 'line-1', quantity: 1, item: ITEM }]}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={onCheckout}
        isLoading={false}
      />
    );
    await user.click(document.querySelector('.remove-btn'));
    expect(onRemoveItem).toHaveBeenCalledWith('line-1');
  });

  it('overlay_click_calls_onClose_content_click_does_not', async () => {
    const user = userEvent.setup();
    render(
      <CartDrawer
        isOpen
        onClose={onClose}
        cartItems={[{ item_id: 'line-1', quantity: 1, item: ITEM }]}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={onCheckout}
        isLoading={false}
      />
    );
    await user.click(document.querySelector('.cart-drawer-overlay'));
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    await user.click(document.querySelector('.cart-drawer-content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('header_close_button_calls_onClose', async () => {
    const user = userEvent.setup();
    render(
      <CartDrawer
        isOpen
        onClose={onClose}
        cartItems={[{ item_id: 'line-1', quantity: 1, item: ITEM }]}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={onCheckout}
        isLoading={false}
      />
    );
    const header = document.querySelector('.cart-drawer-header');
    const closeBtn = within(header).getAllByRole('button').find((b) => b.classList.contains('close-btn'));
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
    expect(onCheckout).not.toHaveBeenCalled();
  });

  it('checkout_button_calls_onCheckout', async () => {
    const user = userEvent.setup();
    render(
      <CartDrawer
        isOpen
        onClose={onClose}
        cartItems={[{ item_id: 'line-1', quantity: 1, item: ITEM }]}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={onCheckout}
        isLoading={false}
      />
    );
    await user.click(screen.getByRole('button', { name: /Thanh toán ngay/ }));
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it('free_price_item_shows_miễn_phí_and_subtotal_handles_zero', () => {
    render(
      <CartDrawer
        isOpen
        onClose={onClose}
        cartItems={[{ item_id: 'line-1', quantity: 3, item: { ...ITEM, price: 0 } }]}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={onCheckout}
        isLoading={false}
      />
    );
    expect(screen.getByText('Miễn phí')).toBeInTheDocument();
    expect(screen.getAllByText('0đ').length).toBeGreaterThanOrEqual(1);
  });

  it('missing_item_nested_fields_does_not_throw_and_subtotal_zero', () => {
    render(
      <CartDrawer
        isOpen
        onClose={onClose}
        cartItems={[{ item_id: 'x', quantity: 2, item: null }]}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onCheckout={onCheckout}
        isLoading={false}
      />
    );
    expect(screen.getAllByText('0đ').length).toBeGreaterThanOrEqual(1);
  });
});
