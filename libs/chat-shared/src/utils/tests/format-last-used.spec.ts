import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatLastUsed } from '../format-last-used';

describe('formatLastUsed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string for undefined', () => {
    expect(formatLastUsed(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatLastUsed()).toBe('');
  });

  it.each([
    [
      'returns empty string for invalid date string',
      { timestamp: new Date('not-a-date').getTime(), expected: '' },
    ],
    [
      'returns "just now" for timestamps under 1 minute ago',
      {
        timestamp: Date.parse('2026-06-18T11:59:30.000Z'),
        expected: 'just now',
      },
    ],
    [
      'returns "just now" for timestamp exactly now',
      {
        timestamp: Date.parse('2026-06-18T12:00:00.000Z'),
        expected: 'just now',
      },
    ],
    [
      'returns "1 min ago" for 1 minute ago',
      {
        timestamp: Date.parse('2026-06-18T11:59:00.000Z'),
        expected: '1 min ago',
      },
    ],
    [
      'returns "10 min ago" for 10 minutes ago',
      {
        timestamp: Date.parse('2026-06-18T11:50:00.000Z'),
        expected: '10 min ago',
      },
    ],
    [
      'returns "59 min ago" for 59 minutes ago',
      {
        timestamp: Date.parse('2026-06-18T11:01:00.000Z'),
        expected: '59 min ago',
      },
    ],
    [
      'returns "1 hour ago" for 1 hour ago',
      {
        timestamp: Date.parse('2026-06-18T11:00:00.000Z'),
        expected: '1 hour ago',
      },
    ],
    [
      'returns "3 hours ago" for 3 hours ago',
      {
        timestamp: Date.parse('2026-06-18T09:00:00.000Z'),
        expected: '3 hours ago',
      },
    ],
    [
      'returns "23 hours ago" for 23 hours ago',
      {
        timestamp: Date.parse('2026-06-17T13:00:00.000Z'),
        expected: '23 hours ago',
      },
    ],
    [
      'returns "1 day ago" for 1 day ago',
      {
        timestamp: Date.parse('2026-06-17T12:00:00.000Z'),
        expected: '1 day ago',
      },
    ],
    [
      'returns "5 days ago" for 5 days ago',
      {
        timestamp: Date.parse('2026-06-13T12:00:00.000Z'),
        expected: '5 days ago',
      },
    ],
    [
      'returns "1 month ago" for ~30 days ago',
      {
        timestamp: Date.parse('2026-05-19T12:00:00.000Z'),
        expected: '1 month ago',
      },
    ],
    [
      'returns "3 months ago" for ~90 days ago',
      {
        timestamp: Date.parse('2026-03-19T12:00:00.000Z'),
        expected: '3 months ago',
      },
    ],
    [
      'returns "1 year ago" for ~365 days ago',
      {
        timestamp: Date.parse('2025-06-18T12:00:00.000Z'),
        expected: '1 year ago',
      },
    ],
    [
      'returns "2 years ago" for ~730 days ago',
      {
        timestamp: Date.parse('2024-06-18T12:00:00.000Z'),
        expected: '2 years ago',
      },
    ],
  ])('%s', (_name, { timestamp, expected }) => {
    expect(formatLastUsed(timestamp)).toBe(expected);
  });
});
