import { describe, expect, it } from 'vitest';
import {
  calendarValueToDateValue,
  calendarValueToDayOfWeek,
  calendarValueToRunAt,
  dateValueToCalendarValue,
  dayOfWeekToCalendarValue,
  runAtToCalendarValue,
} from '../calendar-value';

describe('runAtToCalendarValue', () => {
  it('parses a datetime-local string into a Date', () => {
    const result = runAtToCalendarValue('2026-08-05T09:30');

    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getFullYear()).toBe(2026);
  });

  it('returns null when runAt is undefined', () => {
    expect(runAtToCalendarValue(undefined)).toBeNull();
  });
});

describe('calendarValueToRunAt', () => {
  it('formats a Date into a datetime-local string', () => {
    const date = new Date(2026, 7, 5, 9, 30);

    expect(calendarValueToRunAt(date)).toBe('2026-08-05T09:30');
  });

  it('returns an empty string for null', () => {
    expect(calendarValueToRunAt(null)).toBe('');
  });

  it('returns an empty string for an invalid date string', () => {
    expect(calendarValueToRunAt('not-a-date')).toBe('');
  });
});

describe('dateValueToCalendarValue', () => {
  it('parses a YYYY-MM-DD string into a Date', () => {
    const result = dateValueToCalendarValue('2026-08-05');

    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getFullYear()).toBe(2026);
  });

  it('returns null when the date value is undefined', () => {
    expect(dateValueToCalendarValue(undefined)).toBeNull();
  });
});

describe('calendarValueToDateValue', () => {
  it('formats a Date into a YYYY-MM-DD string', () => {
    const date = new Date(2026, 7, 5, 9, 30);

    expect(calendarValueToDateValue(date)).toBe('2026-08-05');
  });

  it('returns an empty string for null', () => {
    expect(calendarValueToDateValue(null)).toBe('');
  });

  it('returns an empty string for an invalid date string', () => {
    expect(calendarValueToDateValue('not-a-date')).toBe('');
  });

  it('round-trips a date value through dateValueToCalendarValue and back', () => {
    const roundTripped = calendarValueToDateValue(
      dateValueToCalendarValue('2026-08-05'),
    );

    expect(roundTripped).toBe('2026-08-05');
  });
});

describe('dayOfWeekToCalendarValue / calendarValueToDayOfWeek', () => {
  it('round-trips every APScheduler weekday including Sunday', () => {
    for (let apSchedulerDay = 0; apSchedulerDay <= 6; apSchedulerDay += 1) {
      const isoValue = dayOfWeekToCalendarValue(String(apSchedulerDay));

      expect(calendarValueToDayOfWeek(isoValue)).toBe(String(apSchedulerDay));
    }
  });

  it('maps APScheduler Sunday (6) to ISO weekday 7', () => {
    expect(dayOfWeekToCalendarValue('6')).toBe('7');
  });

  it('maps ISO weekday 7 (Sunday) back to APScheduler Sunday (6)', () => {
    expect(calendarValueToDayOfWeek('7')).toBe('6');
  });

  it('returns null for dayOfWeekToCalendarValue when dayOfWeek is unset', () => {
    expect(dayOfWeekToCalendarValue(undefined)).toBeNull();
  });

  it('returns an empty string for calendarValueToDayOfWeek when value is not a numeric string', () => {
    expect(calendarValueToDayOfWeek(null)).toBe('');
  });
});
