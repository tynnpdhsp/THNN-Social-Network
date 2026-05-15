/**
 * Side-effect import: mocks `useAuth` for components that import AuthContext.
 * Import this file first in the test file (before other imports).
 *
 *   import '../../_fakes/setupAuthMock.js';
 *   import { mockUseAuth, defaultAuthMockValue } from '../../_fakes/setupAuthMock.js';
 */
import { vi } from 'vitest';

export function defaultAuthMockValue(overrides = {}) {
  return {
    user: { id: 'u-test', full_name: 'Test User', avatar_url: null, role: 'student' },
    token: null,
    loading: false,
    onlineUsers: [],
    changePassword: vi.fn(async () => ({ success: true })),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    ...overrides,
  };
}

const { mockUseAuth } = vi.hoisted(() => {
  const mockUseAuth = vi.fn(() => defaultAuthMockValue());
  return { mockUseAuth };
});

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }) => children,
}));

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }) => children,
}));

/** @deprecated use `mockUseAuth` — kept for older tests */
export const authMock = { mockUseAuth };

export { mockUseAuth };
