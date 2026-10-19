import { describe, expect, it } from 'vitest';
import { ConversationStartKind } from '../../types/conversation-start-kind';
import {
  formatAbsoluteDateTime,
  formatConversationStart,
  formatRelativeTime,
  parseTimestamp,
} from '../date-time';

/* ICU may emit U+202F before AM/PM; compare on plain spaces. */
const normalizeSpaces = (text: string) => text.replace(/\s/g, ' ');

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(
    date,
  );

describe('parseTimestamp', () => {
  it('parses a valid ISO timestamp', () => {
    expect(parseTimestamp('2026-09-20T07:15:00.000Z')?.toISOString()).toBe(
      '2026-09-20T07:15:00.000Z',
    );
  });

  it('returns null for a missing, empty or invalid timestamp', () => {
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp('not-a-date')).toBeNull();
  });
});

describe('formatConversationStart', () => {
  const now = new Date(2026, 9, 19, 14, 30);

  it('returns Today with the localized time for a start earlier today', () => {
    const start = new Date(2026, 9, 19, 11, 51);

    expect(formatConversationStart(start, now, 'en')).toEqual({
      kind: ConversationStartKind.Today,
      text: formatTime(start),
    });
  });

  it('returns Yesterday with the localized time for a start on the previous day', () => {
    const start = new Date(2026, 9, 18, 15, 24);

    expect(formatConversationStart(start, now, 'en')).toEqual({
      kind: ConversationStartKind.Yesterday,
      text: formatTime(start),
    });
  });

  it('returns the full localized date and time for an older start', () => {
    const result = formatConversationStart(
      new Date(2026, 8, 20, 10, 15),
      now,
      'en',
    );

    expect(result.kind).toBe(ConversationStartKind.Absolute);
    expect(normalizeSpaces(result.text)).toBe('Sep 20, 2026, 10:15 AM');
  });

  it('treats 23:59 yesterday as Yesterday right after local midnight', () => {
    expect(
      formatConversationStart(
        new Date(2026, 9, 18, 23, 59),
        new Date(2026, 9, 19, 0, 1),
        'en',
      ).kind,
    ).toBe(ConversationStartKind.Yesterday);
  });

  it('treats Dec 31 as Yesterday on Jan 1', () => {
    expect(
      formatConversationStart(
        new Date(2025, 11, 31, 20, 0),
        new Date(2026, 0, 1, 9, 0),
        'en',
      ).kind,
    ).toBe(ConversationStartKind.Yesterday);
  });

  it('uses the absolute form for the same day of month in an earlier month', () => {
    expect(
      formatConversationStart(new Date(2026, 8, 19, 11, 51), now, 'en').kind,
    ).toBe(ConversationStartKind.Absolute);
  });
});

describe('formatRelativeTime', () => {
  const now = new Date(2026, 9, 19, 20, 25);
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

  it('returns "now" for less than a minute ago or a slightly future date', () => {
    expect(formatRelativeTime(ago(30), now, 'en')).toBe('now');
    expect(formatRelativeTime(ago(-5), now, 'en')).toBe('now');
  });

  it('returns whole minutes and hours', () => {
    expect(formatRelativeTime(ago(5 * 60 + 40), now, 'en')).toBe(
      '5 minutes ago',
    );
    expect(formatRelativeTime(ago(3 * 3600 + 59 * 60), now, 'en')).toBe(
      '3 hours ago',
    );
  });

  it('returns "yesterday", weeks, months and years for older dates', () => {
    expect(formatRelativeTime(ago(26 * 3600), now, 'en')).toBe('yesterday');
    expect(formatRelativeTime(ago(15 * 86400), now, 'en')).toBe('2 weeks ago');
    expect(formatRelativeTime(ago(65 * 86400), now, 'en')).toBe('2 months ago');
    expect(formatRelativeTime(ago(400 * 86400), now, 'en')).toBe('last year');
  });
});

describe('formatAbsoluteDateTime', () => {
  it('formats the full localized date and time', () => {
    expect(
      normalizeSpaces(
        formatAbsoluteDateTime(new Date(2026, 9, 19, 17, 25), 'en'),
      ),
    ).toBe('Oct 19, 2026, 5:25 PM');
  });
});
