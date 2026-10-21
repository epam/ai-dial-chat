import type { ConversationStartParts } from '../models/conversation-start';
import { ConversationStartKind } from '../types/conversation-start-kind';

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

const ABSOLUTE_DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  ...TIME_FORMAT,
};

const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', YEAR],
  ['month', MONTH],
  ['week', WEEK],
  ['day', DAY],
  ['hour', HOUR],
  ['minute', MINUTE],
];

const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Parses an ISO timestamp, returning `null` when it is missing or invalid. */
export const parseTimestamp = (timestamp: string | undefined): Date | null => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Formats `date` as a localized absolute date and time, e.g. `Oct 19, 2026, 5:25 PM`. */
export const formatAbsoluteDateTime = (
  date: Date,
  locale: string | undefined,
): string =>
  new Intl.DateTimeFormat(locale, ABSOLUTE_DATE_TIME_FORMAT).format(date);

/** Returns whether `start` falls on today, yesterday or earlier (local calendar days) with its localized text. */
export const formatConversationStart = (
  start: Date,
  now: Date,
  locale: string | undefined,
): ConversationStartParts => {
  // Built from local date parts (not `now - 24h`) so DST days stay correct.
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );

  if (isSameLocalDay(start, now)) {
    return {
      kind: ConversationStartKind.Today,
      text: new Intl.DateTimeFormat(locale, TIME_FORMAT).format(start),
    };
  }
  if (isSameLocalDay(start, yesterday)) {
    return {
      kind: ConversationStartKind.Yesterday,
      text: new Intl.DateTimeFormat(locale, TIME_FORMAT).format(start),
    };
  }
  return {
    kind: ConversationStartKind.Absolute,
    text: formatAbsoluteDateTime(start, locale),
  };
};

/** Returns how long ago `date` was relative to `now`, e.g. `3 hours ago`, `yesterday`, `now`. */
export const formatRelativeTime = (
  date: Date,
  now: Date,
  locale: string | undefined,
): string => {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const elapsedSeconds = (now.getTime() - date.getTime()) / 1000;

  // Largest whole unit wins; under a minute (or clock skew) reads as "now".
  for (const [unit, seconds] of RELATIVE_UNITS) {
    const count = Math.floor(elapsedSeconds / seconds);
    if (count >= 1) return formatter.format(-count, unit);
  }
  return formatter.format(0, 'second');
};
