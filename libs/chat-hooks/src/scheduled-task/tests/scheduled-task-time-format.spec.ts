import { describe, expect, it } from 'vitest';
import { formatScheduledTaskInstant } from '../scheduled-task-time-format';

/** 15:45 UTC: 16:45 in Paris and 17:45 in Kyiv (both on winter time in November). */
const INSTANT = '2026-11-19T15:45:00.000Z';

describe('formatScheduledTaskInstant', () => {
  it('formats the instant in the given zone', () => {
    expect(formatScheduledTaskInstant(INSTANT, 'en-US', 'Europe/Kyiv')).toBe(
      new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Kyiv',
      }).format(new Date(INSTANT)),
    );
    expect(
      formatScheduledTaskInstant(INSTANT, 'en-US', 'Europe/Kyiv'),
    ).toContain('5:45');
    expect(
      formatScheduledTaskInstant(INSTANT, 'en-US', 'Europe/Paris'),
    ).toContain('4:45');
  });

  it("uses the runtime's default zone when no zone is given", () => {
    expect(formatScheduledTaskInstant(INSTANT, 'en-US')).toBe(
      new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(INSTANT)),
    );
  });

  it('returns the raw value for an unparseable instant', () => {
    expect(formatScheduledTaskInstant('not-a-date', 'en-US', 'UTC')).toBe(
      'not-a-date',
    );
  });

  it('returns the raw value for an unknown zone', () => {
    expect(formatScheduledTaskInstant(INSTANT, 'en-US', 'Mars/Olympus')).toBe(
      INSTANT,
    );
  });
});
