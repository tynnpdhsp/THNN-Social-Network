import { vi } from 'vitest';

/**
 * Freeze Date.now / new Date to a fixed instant (UTC).
 * @param {string|number|Date} isoOrMs
 */
export function freezeDate(isoOrMs) {
  const d = isoOrMs instanceof Date ? isoOrMs : new Date(isoOrMs);
  vi.useFakeTimers();
  vi.setSystemTime(d);
}

/** Advance fake timers by ms (requires freezeDate or vi.useFakeTimers first). */
export function advanceTimers(ms) {
  vi.advanceTimersByTime(ms);
}
