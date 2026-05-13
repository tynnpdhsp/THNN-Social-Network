import React from 'react';
import { render } from '@testing-library/react';
import { AuthProvider } from '../../../src/context/AuthContext.jsx';
import { ConfirmProvider } from '../../../src/components/Common/ConfirmDialog.jsx';

/**
 * Render tree wrapped in `AuthProvider` (real app provider).
 * Mock `fetch` / `apiFetch` before mount if the subtree triggers profile load (token in localStorage).
 *
 * @param {React.ReactElement} ui
 * @param {import('@testing-library/react').RenderOptions & { withConfirm?: boolean }} [options]
 */
export function renderWithAuth(ui, options = {}) {
  const { withConfirm = false, ...renderOptions } = options;

  function Wrapper({ children }) {
    if (withConfirm) {
      return (
        <ConfirmProvider>
          <AuthProvider>{children}</AuthProvider>
        </ConfirmProvider>
      );
    }
    return <AuthProvider>{children}</AuthProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Render tree wrapped in `ConfirmProvider` only (for components using `useConfirm`).
 * @param {React.ReactElement} ui
 * @param {import('@testing-library/react').RenderOptions} [options]
 */
export function renderWithConfirm(ui, options = {}) {
  function Wrapper({ children }) {
    return <ConfirmProvider>{children}</ConfirmProvider>;
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
