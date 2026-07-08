import { describe, expect, it } from 'vitest';
import { formatPublishedDate } from '../format-published-date';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-07-06T12:00:00Z').getTime();

describe('formatPublishedDate', () => {
  it('returns "Today" for a timestamp from earlier today', () => {
    expect(formatPublishedDate(NOW - 60 * 1000, NOW)).toBe('Today');
  });

  it('returns "Yesterday" for a timestamp one day ago', () => {
    expect(formatPublishedDate(NOW - DAY_MS, NOW)).toBe('Yesterday');
  });

  it('returns "N days ago" for a timestamp within the last week', () => {
    expect(formatPublishedDate(NOW - 3 * DAY_MS, NOW)).toBe('3 days ago');
  });

  it('returns an exact date for a timestamp exactly a week old', () => {
    expect(formatPublishedDate(NOW - 7 * DAY_MS, NOW)).toBe('Jun 29, 2026');
  });

  it('returns an exact date for a timestamp months old', () => {
    expect(formatPublishedDate(NOW - 90 * DAY_MS, NOW)).toBe('Apr 7, 2026');
  });
});
