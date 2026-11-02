import type { ScheduleCronDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import { getNextCronOccurrence } from '../scheduled-task-next-occurrence';

describe('getNextCronOccurrence', () => {
  /* 7 Oct 2026, 08:00 UTC. */
  const from = new Date('2026-10-07T08:00:00.000Z');
  const cron = (fields: Record<string, string | null>): ScheduleCronDto => ({
    fields: fields as ScheduleCronDto['fields'],
  });

  it('returns today when the time of day is still ahead', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0' }),
        from,
      )?.toISOString(),
    ).toBe('2026-10-07T09:00:00.000Z');
  });

  it('returns tomorrow when the time of day has already passed', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '7', minute: '0' }),
        from,
      )?.toISOString(),
    ).toBe('2026-10-08T07:00:00.000Z');
  });

  it('returns undefined when hour or minute is not a plain number', () => {
    expect(getNextCronOccurrence(cron({ hour: '*', minute: '0' }), from)).toBe(
      undefined,
    );
  });

  it('returns the next matching weekday for a weekly trigger', () => {
    /* APScheduler Monday=0; 7 Oct 2026 is a Wednesday. */
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day_of_week: '0', day: null }),
        from,
      )?.toISOString(),
    ).toBe('2026-10-12T09:00:00.000Z');
  });

  it('returns today for a weekly trigger on the current weekday', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day_of_week: '2' }),
        from,
      )?.toISOString(),
    ).toBe('2026-10-07T09:00:00.000Z');
  });

  it('returns next week when the weekday time has already passed', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '7', minute: '0', day_of_week: '2' }),
        from,
      )?.toISOString(),
    ).toBe('2026-10-14T07:00:00.000Z');
  });

  it('returns the next matching day of month for a monthly trigger', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day: '15', day_of_week: null }),
        from,
      )?.toISOString(),
    ).toBe('2026-10-15T09:00:00.000Z');
  });

  it('rolls a passed day of month over to the next month', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day: '5' }),
        from,
      )?.toISOString(),
    ).toBe('2026-11-05T09:00:00.000Z');
  });

  it('skips months that do not have the day of month', () => {
    /* November has no 31st. */
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day: '31' }),
        new Date('2026-11-01T00:00:00.000Z'),
      )?.toISOString(),
    ).toBe('2026-12-31T09:00:00.000Z');
  });

  it('resolves the last day of the month', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day: 'last' }),
        from,
      )?.toISOString(),
    ).toBe('2026-10-31T09:00:00.000Z');
  });

  it('returns undefined for a day constraint it cannot evaluate', () => {
    expect(
      getNextCronOccurrence(
        cron({ hour: '9', minute: '0', day_of_week: 'mon-fri' }),
        from,
      ),
    ).toBe(undefined);
  });
});
