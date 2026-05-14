import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { ConfirmProvider, useConfirm } from '@/components/Common/ConfirmDialog.jsx';

function Probe() {
  const confirm = useConfirm();
  const [r, setR] = useState('');
  return (
    <div>
      <button type="button" onClick={() => void confirm({ title: 'Q', message: 'M?' }).then((v) => setR(String(v)))}>
        ask
      </button>
      <span data-testid="r">{r}</span>
    </div>
  );
}

describe('ConfirmDialog + ConfirmProvider', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('useConfirm_outside_provider_throws', () => {
    expect(() => render(<Probe />)).toThrow(/useConfirm must be used within ConfirmProvider/);
  });

  it('confirm_primary_resolves_true_after_timer', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <Probe />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: /ask/i }));
    await user.click(await screen.findByRole('button', { name: /^Xác nhận$/i }));
    await waitFor(() => expect(screen.getByTestId('r').textContent).toBe('true'), { timeout: 5000 });
  });

  it('cancel_button_resolves_false_after_timer', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <Probe />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: /ask/i }));
    const cancel = (await screen.findAllByRole('button', { name: /^Hủy$/i }))[0];
    await user.click(cancel);
    await waitFor(() => expect(screen.getByTestId('r').textContent).toBe('false'), { timeout: 5000 });
  });

  it('backdrop_click_resolves_false_after_timer', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <Probe />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: /ask/i }));
    await screen.findByText('M?');
    const outer = screen.getByText('M?').parentElement.parentElement;
    const backdrop = outer.firstElementChild;
    expect(backdrop).toBeTruthy();
    await user.click(backdrop);
    await waitFor(() => expect(screen.getByTestId('r').textContent).toBe('false'), { timeout: 5000 });
  });

  it('Escape_keydown_resolves_false_after_timer', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <Probe />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: /ask/i }));
    await screen.findByText('M?');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByTestId('r').textContent).toBe('false'), { timeout: 5000 });
  });

  it('icon_delete_renders_trash_svg', async () => {
    const user = userEvent.setup();
    function IconProbe() {
      const confirm = useConfirm();
      return (
        <button type="button" onClick={() => void confirm({ title: 'Del', message: 'x', icon: 'delete' })}>
          del
        </button>
      );
    }
    const { container } = render(
      <ConfirmProvider>
        <IconProbe />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: /del/i }));
    await screen.findByText('Del');
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it('icon_block_renders_ban_svg', async () => {
    const user = userEvent.setup();
    function B() {
      const c = useConfirm();
      return (
        <button type="button" onClick={() => void c({ title: 'B', message: 'm', icon: 'block' })}>
          b
        </button>
      );
    }
    const { container } = render(
      <ConfirmProvider>
        <B />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: /^b$/i }));
    await screen.findByText('B');
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);
  });

  it('icon_unfriend_renders_userx_svg', async () => {
    const user = userEvent.setup();
    function U() {
      const c = useConfirm();
      return (
        <button type="button" onClick={() => void c({ title: 'U', message: 'm', icon: 'unfriend' })}>
          u
        </button>
      );
    }
    const { container } = render(
      <ConfirmProvider>
        <U />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: /^u$/i }));
    await screen.findByText('U');
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);
  });

  it('icon_warning_renders_alert_triangle', async () => {
    const user = userEvent.setup();
    function W() {
      const c = useConfirm();
      return (
        <button type="button" onClick={() => void c({ title: 'W', message: 'm', icon: 'warning' })}>
          w
        </button>
      );
    }
    const { container } = render(
      <ConfirmProvider>
        <W />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: /^w$/i }));
    await screen.findByText('W');
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);
  });

  it('unknown_icon_falls_back_to_alert_triangle', async () => {
    const user = userEvent.setup();
    function X() {
      const c = useConfirm();
      return (
        <button type="button" onClick={() => void c({ title: 'X', message: 'm', icon: 'nope' })}>
          x
        </button>
      );
    }
    const { container } = render(
      <ConfirmProvider>
        <X />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: /^x$/i }));
    await screen.findByText('X');
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);
  });

  it('variant_danger_confirm_button_present', async () => {
    const user = userEvent.setup();
    function D() {
      const c = useConfirm();
      return (
        <button type="button" onClick={() => void c({ title: 'D', message: 'm', variant: 'danger' })}>
          d
        </button>
      );
    }
    render(
      <ConfirmProvider>
        <D />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: /^d$/i }));
    expect(await screen.findByRole('button', { name: /^Xác nhận$/i })).toBeInTheDocument();
  });

  it('variant_warning_confirm_button_present', async () => {
    const user = userEvent.setup();
    function W2() {
      const c = useConfirm();
      return (
        <button type="button" onClick={() => void c({ title: 'W2', message: 'm', variant: 'warning' })}>
          w2
        </button>
      );
    }
    render(
      <ConfirmProvider>
        <W2 />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: /^w2$/i }));
    expect(await screen.findByRole('button', { name: /^Xác nhận$/i })).toBeInTheDocument();
  });

  it('custom_confirm_and_cancel_text', async () => {
    const user = userEvent.setup();
    function C() {
      const c = useConfirm();
      return (
        <button type="button" onClick={() => void c({ title: 'T', message: 'm', confirmText: 'OKAY', cancelText: 'NOPE' })}>
          c
        </button>
      );
    }
    render(
      <ConfirmProvider>
        <C />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: /^c$/i }));
    expect(await screen.findByRole('button', { name: /^OKAY$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^NOPE$/i })).toBeInTheDocument();
  });

  it('close_X_corner_resolves_false', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <Probe />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: /ask/i }));
    await screen.findByText('M?');
    const card = screen.getByText('M?').parentElement;
    const xBtn = within(card).getAllByRole('button')[0];
    await user.click(xBtn);
    await waitFor(() => expect(screen.getByTestId('r').textContent).toBe('false'), { timeout: 5000 });
  });
});
