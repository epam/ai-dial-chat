import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../relative-time';

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatRelativeTime', () => {
  it('uses the largest whole unit', () => {
    expect(formatRelativeTime(NOW - 49 * MINUTE, NOW, 'en')).toBe(
      '49 minutes ago',
    );
    expect(formatRelativeTime(NOW - 20 * HOUR, NOW, 'en')).toBe('20 hours ago');
    expect(formatRelativeTime(NOW - 3 * DAY, NOW, 'en')).toBe('3 days ago');
    expect(formatRelativeTime(NOW - 8 * DAY, NOW, 'en')).toBe('1 week ago');
  });

  it('keeps a single unit numeric instead of "yesterday"', () => {
    expect(formatRelativeTime(NOW - DAY, NOW, 'en')).toBe('1 day ago');
  });

  it('reads under a minute and clock skew as now', () => {
    expect(formatRelativeTime(NOW - 30 * 1000, NOW, 'en')).toBe('now');
    expect(formatRelativeTime(NOW + 5 * MINUTE, NOW, 'en')).toBe('now');
  });
});
