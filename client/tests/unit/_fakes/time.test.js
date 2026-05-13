import { describe, it, expect, afterEach, vi } from 'vitest';
import { freezeDate, advanceTimers } from './time.js';

describe('time helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('freezeDate_sets_system_time', () => {
    freezeDate('2026-05-14T12:00:00.000Z');
    expect(Date.now()).toBe(new Date('2026-05-14T12:00:00.000Z').getTime());
  });

  it('advanceTimers_moves_time_forward', () => {
    freezeDate('2026-01-01T00:00:00.000Z');
    const t0 = Date.now();
    advanceTimers(60_000);
    expect(Date.now()).toBe(t0 + 60_000);
  });
});
