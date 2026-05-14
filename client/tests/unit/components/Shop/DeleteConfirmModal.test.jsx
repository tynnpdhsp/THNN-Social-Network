import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import DeleteConfirmModal from '@/components/Shop/DeleteConfirmModal.jsx';

describe('DeleteConfirmModal', () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isOpen_false_renders_nothing', () => {
    const { container } = render(
      <DeleteConfirmModal isOpen={false} onClose={onClose} onConfirm={onConfirm} itemName="X" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows_itemName_and_default_itemType_in_message', () => {
    render(
      <DeleteConfirmModal isOpen onClose={onClose} onConfirm={onConfirm} itemName="Notebook Pro" />
    );
    expect(screen.getByRole('heading', { name: 'Xác nhận xoá' })).toBeInTheDocument();
    expect(screen.getByText(/Notebook Pro/)).toBeInTheDocument();
    expect(screen.getByText(/vật phẩm/)).toBeInTheDocument();
  });

  it('custom_itemType_appears_in_copy', () => {
    render(
      <DeleteConfirmModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        itemName="A"
        itemType="bài viết"
      />
    );
    expect(screen.getByText(/bài viết/)).toBeInTheDocument();
  });

  it('overlay_mouseDown_on_backdrop_calls_onClose', () => {
    render(<DeleteConfirmModal isOpen onClose={onClose} onConfirm={onConfirm} itemName="Z" />);
    const overlay = document.querySelector('[style*="z-index: 2000"]');
    expect(overlay).toBeTruthy();
    fireEvent.mouseDown(overlay, { target: overlay });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mouseDown_on_modal_panel_does_not_call_onClose', () => {
    render(<DeleteConfirmModal isOpen onClose={onClose} onConfirm={onConfirm} itemName="Z" />);
    const overlay = document.querySelector('[style*="z-index: 2000"]');
    const panel = overlay.firstElementChild;
    expect(panel).toBeTruthy();
    fireEvent.mouseDown(panel, { target: panel });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('confirm_button_calls_onConfirm', async () => {
    const user = userEvent.setup();
    render(<DeleteConfirmModal isOpen onClose={onClose} onConfirm={onConfirm} itemName="Z" />);
    await user.click(screen.getByRole('button', { name: 'Xác nhận xoá' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancel_button_calls_onClose', async () => {
    const user = userEvent.setup();
    render(<DeleteConfirmModal isOpen onClose={onClose} onConfirm={onConfirm} itemName="Z" />);
    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('top_right_X_calls_onClose', async () => {
    const user = userEvent.setup();
    render(<DeleteConfirmModal isOpen onClose={onClose} onConfirm={onConfirm} itemName="Z" />);
    const xBtns = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-x'));
    await user.click(xBtns[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
