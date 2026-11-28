import type { ScheduleCronDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  getNextCronOccurrence,
  hasScheduledTaskWindowEnded,
} from '../scheduled-task-next-occurrence';

describe('getNextCronOccurrence', () => {
  /* 7 Oct 2026, 08:00 UTC, which is 10:00 in Europe/Berlin and 17:00 in Asia/Tokyo. */
  const from = new Date('2026-10-07T08:00:00.000Z');
  const cron = (fields: Record<string, string | null>): ScheduleCronDto => ({
    fields: fields as ScheduleCronDto['fields'],
  });

  it('returns today when the time of day is still ahead in the task zone', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '11', minute: '0' }),
        'Europe/Berlin',
        from,
      ),
    ).toBe('2026-10-07T11:00');
  });

  it('returns tomorrow when the time of day has already passed in the task zone', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0' }),
        'Europe/Berlin',
        from,
      ),
    ).toBe('2026-10-08T09:00');
  });

  it('reads the clock of the task zone, not of UTC', () => {
    const daily = cron({ hour: '9', minute: '0' });

    expect(getNextCronOccurrence(daily, 'UTC', from)).toBe('2026-10-07T09:00');
    expect(getNextCronOccurrence(daily, 'Asia/Tokyo', from)).toBe(
      '2026-10-08T09:00',
    );
  });

  it('returns undefined when hour or minute is not a plain number', () => {
    expect(
      getNextCronOccurrence(cron({ hour: '*', minute: '0' }), 'UTC', from),
    ).toBeUndefined();
  });

  it('returns undefined for an unknown zone', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0' }),
        'Mars/Olympus',
        from,
      ),
    ).toBeUndefined();
  });

  it('returns the next matching weekday for a weekly trigger', () => {
    /* APScheduler Monday=0; 7 Oct 2026 is a Wednesday. */
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day_of_week: '0', day: null }),
        'UTC',
        from,
      ),
    ).toBe('2026-10-12T09:00');
  });

  it.each([
    [
      'returns today for a weekly trigger on the current weekday',
      {
        trigger: { hour: '9', minute: '0', day_of_week: '2' },
        expected: '2026-10-07T09:00',
      },
    ],
    [
      'returns next week when the weekday time has already passed',
      {
        trigger: { hour: '7', minute: '0', day_of_week: '2' },
        expected: '2026-10-14T07:00',
      },
    ],
    [
      'returns the earliest matching day of a weekday list',
      {
        trigger: { hour: '9', minute: '0', day_of_week: '0,4' },
        expected: '2026-10-09T09:00',
      },
    ],
  ])('%s', (_name, { trigger, expected }) => {
    expect(getNextCronOccurrence(cron(trigger), 'UTC', from)).toBe(expected);
  });

  it('uses the weekday of the task zone when it is already tomorrow there', () => {
    /* 7 Oct 2026 08:00Z is still Wednesday in Berlin; at 23:30Z it is Thursday 01:30 in Berlin. */
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day_of_week: '3' }),
        'Europe/Berlin',
        new Date('2026-10-07T23:30:00.000Z'),
      ),
    ).toBe('2026-10-08T09:00');
  });

  it('returns the next matching day of month for a monthly trigger', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day: '15', day_of_week: null }),
        'UTC',
        from,
      ),
    ).toBe('2026-10-15T09:00');
  });

  it('rolls a passed day of month over to the next month', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day: '5' }),
        'UTC',
        from,
      ),
    ).toBe('2026-11-05T09:00');
  });

  it('skips months that do not have the day of month', () => {
    /* November has no 31st. */
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day: '31' }),
        'UTC',
        new Date('2026-11-01T00:00:00.000Z'),
      ),
    ).toBe('2026-12-31T09:00');
  });

  it('resolves the last day of the month written by older clients', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day: 'last' }),
        'UTC',
        from,
      ),
    ).toBe('2026-10-31T09:00');
  });

  it('returns undefined for a day constraint it cannot evaluate', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day_of_week: 'mon-fri' }),
        'UTC',
        from,
      ),
    ).toBeUndefined();
  });
});

describe('hasScheduledTaskWindowEnded', () => {
  const now = Date.parse('2026-10-07T08:00:00.000Z');

  it.each([
    ['2026-10-07T07:59:59.000Z', true],
    ['2026-10-07T08:00:00.000Z', true],
    ['2026-10-07T08:00:01.000Z', false],
  ])('compares %s with now', (endDate, expected) => {
    expect(hasScheduledTaskWindowEnded(endDate, now)).toBe(expected);
  });
});
