import { describe, expect, it } from 'vitest';
import {
  getZonedNow,
  instantToZonedDateTime,
  isNonexistentLocalTime,
  shiftForwardOverGap,
} from '../zoned-wall-clock';

describe('getZonedNow', () => {
  it('returns the wall clock of the zone, not of the process', () => {
    const now = new Date('2026-03-10T16:00:00Z');

    expect(getZonedNow(now, 'Europe/Berlin')).toEqual({
      date: '2026-03-10',
      dateTime: '2026-03-10T17:00',
      dateTimeWithSeconds: '2026-03-10T17:00:00',
    });
    expect(getZonedNow(now, 'Asia/Tokyo')).toEqual({
      date: '2026-03-11',
      dateTime: '2026-03-11T01:00',
      dateTimeWithSeconds: '2026-03-11T01:00:00',
    });
  });

  it.each([
    ['Asia/Kolkata', '2026-11-13T17:30'],
    ['Asia/Kathmandu', '2026-11-13T17:45'],
    ['Australia/Lord_Howe', '2026-11-13T23:00'],
    ['UTC', '2026-11-13T12:00'],
  ])('handles the %s offset', (timezone, expected) => {
    expect(
      getZonedNow(new Date('2026-11-13T12:00:00Z'), timezone).dateTime,
    ).toBe(expected);
  });

  it('rolls over a year boundary', () => {
    expect(
      getZonedNow(new Date('2026-12-31T23:30:00Z'), 'Pacific/Auckland').date,
    ).toBe('2027-01-01');
  });

  it('throws a RangeError for an unknown zone', () => {
    expect(() => getZonedNow(new Date(), 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('instantToZonedDateTime', () => {
  it.each([
    [
      'shows a UTC instant as the zone wall time',
      {
        instant: '2026-07-24T07:00:00.000Z',
        timezone: 'Europe/Berlin',
        expected: '2026-07-24T09:00',
      },
    ],
    [
      'uses the offset in force on that date',
      {
        instant: '2026-01-24T07:00:00.000Z',
        timezone: 'Europe/Berlin',
        expected: '2026-01-24T08:00',
      },
    ],
    [
      'accepts an instant that carries its own offset',
      {
        instant: '2026-07-24T09:00:00+02:00',
        timezone: 'UTC',
        expected: '2026-07-24T07:00',
      },
    ],
  ])('%s', (_title, { instant, timezone, expected }) => {
    expect(instantToZonedDateTime(instant, timezone)).toBe(expected);
  });

  it('returns undefined for a value that is not a date', () => {
    expect(instantToZonedDateTime('not a date', 'UTC')).toBeUndefined();
  });
});

describe('isNonexistentLocalTime', () => {
  it('flags a time inside the Berlin spring-forward gap', () => {
    expect(isNonexistentLocalTime('2027-03-28T02:30', 'Europe/Berlin')).toBe(
      true,
    );
  });

  it('does not flag the repeated autumn hour', () => {
    expect(isNonexistentLocalTime('2027-10-31T02:30', 'Europe/Berlin')).toBe(
      false,
    );
  });

  it('flags the Lord Howe half-hour gap', () => {
    expect(
      isNonexistentLocalTime('2026-10-04T02:15', 'Australia/Lord_Howe'),
    ).toBe(true);
  });

  it.each<[string, { cases: [value: string, timezone: string][] }]>([
    [
      'does not flag a time just outside the gap',
      {
        cases: [
          ['2027-03-28T03:00', 'Europe/Berlin'],
          ['2027-03-28T01:59', 'Europe/Berlin'],
        ],
      },
    ],
    [
      'never flags a zone without clock changes',
      {
        cases: [
          ['2027-03-28T02:30', 'UTC'],
          ['2027-03-28T02:30', 'Asia/Kolkata'],
        ],
      },
    ],
    [
      'returns false for an unparseable value or unknown zone',
      {
        cases: [
          ['nope', 'Europe/Berlin'],
          ['2027-03-28T02:30', 'Mars/Olympus'],
        ],
      },
    ],
  ])('%s', (_title, { cases }) => {
    for (const [value, timezone] of cases) {
      expect(isNonexistentLocalTime(value, timezone)).toBe(false);
    }
  });
});

describe('shiftForwardOverGap', () => {
  it('moves a missing Berlin time forward by the gap', () => {
    expect(shiftForwardOverGap('2027-03-28T02:30', 'Europe/Berlin')).toBe(
      '2027-03-28T03:30',
    );
  });

  it('moves a missing Lord Howe time forward by 30 minutes', () => {
    expect(shiftForwardOverGap('2026-10-04T02:15', 'Australia/Lord_Howe')).toBe(
      '2026-10-04T02:45',
    );
  });

  it('returns an existing time unchanged', () => {
    expect(shiftForwardOverGap('2027-10-31T02:30', 'Europe/Berlin')).toBe(
      '2027-10-31T02:30',
    );
    expect(shiftForwardOverGap('2027-03-28T09:00', 'Europe/Berlin')).toBe(
      '2027-03-28T09:00',
    );
  });
});
