import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import Modal from '@/components/Common/Modal.jsx';

describe('Modal', () => {
  let origRaf;

  beforeEach(() => {
    origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf;
    vi.useRealTimers();
  });

  it('isOpen_false_initially_renders_nothing', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen={false} onClose={onClose} title="T">
        <span>x</span>
      </Modal>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('isOpen_true_renders_title_children_and_close_button', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen title="My modal title" onClose={onClose}>
        <p data-testid="kid">inside</p>
      </Modal>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'My modal title' })).toBeInTheDocument();
    expect(screen.getByTestId('kid')).toHaveTextContent('inside');
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(1);
  });

  it('close_X_button_triggers_onClose_after_220ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen title="T" onClose={onClose}>
        c
      </Modal>,
    );
    const closeBtn = container.querySelector('.premium-modal-box button');
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);
    expect(onClose).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(220);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop_mousedown_then_click_same_target_triggers_onClose_after_delay', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen title="T" onClose={onClose}>
        <div data-testid="content">c</div>
      </Modal>,
    );
    const backdrop = container.firstElementChild;
    expect(backdrop).toBeTruthy();
    fireEvent.mouseDown(backdrop, { target: backdrop, currentTarget: backdrop });
    fireEvent.click(backdrop, { target: backdrop, currentTarget: backdrop });
    expect(onClose).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(220);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mousedown_on_modal_content_then_pointer_release_on_backdrop_does_not_close', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <Modal isOpen title="T" onClose={onClose}>
        <div data-testid="modal-inner">inner</div>
      </Modal>,
    );
    const backdrop = container.firstElementChild;
    const inner = screen.getByTestId('modal-inner');
    await user.pointer([{ keys: '[MouseLeft>]', target: inner }, { keys: '[/MouseLeft]', target: backdrop }]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape_key_does_not_call_onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal isOpen title="T" onClose={onClose}>
        c
      </Modal>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('passes_width_and_overflow_to_modal_box', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen title="T" onClose={onClose} width={600} overflow="hidden">
        x
      </Modal>,
    );
    const box = container.querySelector('.premium-modal-box');
    expect(box).toBeTruthy();
    expect(box.style.width).toBe('600px');
    expect(box.style.overflowY).toBe('hidden');
  });

  it('title_omitted_still_renders_close_button', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        <span>no title</span>
      </Modal>,
    );
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(1);
  });
});
