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

  it('returns empty string for invalid date string', () => {
    expect(formatLastUsed(new Date('not-a-date').getTime())).toBe('');
  });

  it('returns "just now" for timestamps under 1 minute ago', () => {
    expect(formatLastUsed(new Date('2026-06-18T11:59:30.000Z').getTime())).toBe(
      'just now',
    );
  });

  it('returns "just now" for timestamp exactly now', () => {
    expect(formatLastUsed(new Date('2026-06-18T12:00:00.000Z').getTime())).toBe(
      'just now',
    );
  });

  it('returns "1 min ago" for 1 minute ago', () => {
    expect(formatLastUsed(new Date('2026-06-18T11:59:00.000Z').getTime())).toBe(
      '1 min ago',
    );
  });

  it('returns "10 min ago" for 10 minutes ago', () => {
    expect(formatLastUsed(new Date('2026-06-18T11:50:00.000Z').getTime())).toBe(
      '10 min ago',
    );
  });

  it('returns "59 min ago" for 59 minutes ago', () => {
    expect(formatLastUsed(new Date('2026-06-18T11:01:00.000Z').getTime())).toBe(
      '59 min ago',
    );
  });

  it('returns "1 hour ago" for 1 hour ago', () => {
    expect(formatLastUsed(new Date('2026-06-18T11:00:00.000Z').getTime())).toBe(
      '1 hour ago',
    );
  });

  it('returns "3 hours ago" for 3 hours ago', () => {
    expect(formatLastUsed(new Date('2026-06-18T09:00:00.000Z').getTime())).toBe(
      '3 hours ago',
    );
  });

  it('returns "23 hours ago" for 23 hours ago', () => {
    expect(formatLastUsed(new Date('2026-06-17T13:00:00.000Z').getTime())).toBe(
      '23 hours ago',
    );
  });

  it('returns "1 day ago" for 1 day ago', () => {
    expect(formatLastUsed(new Date('2026-06-17T12:00:00.000Z').getTime())).toBe(
      '1 day ago',
    );
  });

  it('returns "5 days ago" for 5 days ago', () => {
    expect(formatLastUsed(new Date('2026-06-13T12:00:00.000Z').getTime())).toBe(
      '5 days ago',
    );
  });

  it('returns "1 month ago" for ~30 days ago', () => {
    expect(formatLastUsed(new Date('2026-05-19T12:00:00.000Z').getTime())).toBe(
      '1 month ago',
    );
  });

  it('returns "3 months ago" for ~90 days ago', () => {
    expect(formatLastUsed(new Date('2026-03-19T12:00:00.000Z').getTime())).toBe(
      '3 months ago',
    );
  });

  it('returns "1 year ago" for ~365 days ago', () => {
    expect(formatLastUsed(new Date('2025-06-18T12:00:00.000Z').getTime())).toBe(
      '1 year ago',
    );
  });

  it('returns "2 years ago" for ~730 days ago', () => {
    expect(formatLastUsed(new Date('2024-06-18T12:00:00.000Z').getTime())).toBe(
      '2 years ago',
    );
  });
});
