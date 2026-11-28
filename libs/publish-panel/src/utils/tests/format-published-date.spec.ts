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

  it.each([
    [
      'returns an exact date for a timestamp exactly a week old',
      { ageDays: 7, locale: 'en-US', expected: 'Jun 29, 2026' },
    ],
    [
      'returns an exact date for a timestamp months old',
      { ageDays: 90, locale: 'en-US', expected: 'Apr 7, 2026' },
    ],
    [
      'formats the exact date using the provided locale',
      { ageDays: 7, locale: 'de-DE', expected: '29. Juni 2026' },
    ],
  ])('%s', (_name, { ageDays, locale, expected }) => {
    expect(formatPublishedDate(NOW - ageDays * DAY_MS, NOW, locale)).toBe(
      expected,
    );
  });
});
