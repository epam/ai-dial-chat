import { describe, expect, it } from 'vitest';
import {
  describeScheduledTaskTrigger,
  ScheduledTaskTriggerDescriptionKind,
} from '../scheduled-task-description';

describe('describeScheduledTaskTrigger', () => {
  it.each(['*', '15', '*/10'])(
    'preserves explicit seconds %s as a custom expression',
    (second) => {
      const fields = { hour: '9', minute: '0', second };
      expect(describeScheduledTaskTrigger({ cron: { fields } })).toMatchObject({
        kind: ScheduledTaskTriggerDescriptionKind.Custom,
        expression: JSON.stringify(fields),
      });
    },
  );

  it('describes the default zero second as a daily schedule', () => {
    expect(
      describeScheduledTaskTrigger({
        cron: { fields: { hour: '9', minute: '0', second: '0' } },
      }),
    ).toMatchObject({
      kind: ScheduledTaskTriggerDescriptionKind.Daily,
      time: '09:00',
    });
  });

  it('describes a weekday list as one weekly schedule, Monday first, at the stored time', () => {
    expect(
      describeScheduledTaskTrigger(
        { cron: { fields: { hour: '7', minute: '0', day_of_week: '4,0,2' } } },
        { timezone: 'Europe/Warsaw' },
      ),
    ).toMatchObject({
      kind: ScheduledTaskTriggerDescriptionKind.Weekly,
      dayOfWeek: '0',
      daysOfWeek: ['0', '2', '4'],
      time: '07:00',
      timezone: 'Europe/Warsaw',
    });
  });

  it('does not shift weekdays or time, whatever the zone', () => {
    expect(
      describeScheduledTaskTrigger(
        { cron: { fields: { hour: '23', minute: '30', day_of_week: '0' } } },
        { timezone: 'Asia/Kathmandu' },
      ),
    ).toMatchObject({ time: '23:30', dayOfWeek: '0' });
  });

  it.each(['0-4', '*/2', '0,0'])(
    'keeps weekday expression %s as a custom expression',
    (dayOfWeek) => {
      const fields = { hour: '9', minute: '0', day_of_week: dayOfWeek };
      expect(describeScheduledTaskTrigger({ cron: { fields } })).toMatchObject({
        kind: ScheduledTaskTriggerDescriptionKind.Custom,
        expression: JSON.stringify(fields),
      });
    },
  );

  it.each(['*/1', '*/2', '2-40', '1,3', '*/12', '2'])(
    'keeps week expression %s as a custom expression',
    (week) => {
      const fields = { week, hour: '9', minute: '0', day_of_week: '0' };
      expect(describeScheduledTaskTrigger({ cron: { fields } })).toMatchObject({
        kind: ScheduledTaskTriggerDescriptionKind.Custom,
        expression: JSON.stringify(fields),
      });
    },
  );

  it.each<Record<string, string>>([
    { week: '*/2', hour: '*', minute: '*/5' },
    { week: '*/2', minute: '*/5' },
    { week: '*/2', hour: '*', minute: '0' },
    { week: '*/2', hour: '9', minute: '0' },
  ])('preserves week-constrained non-weekly shapes as custom: %j', (fields) => {
    expect(describeScheduledTaskTrigger({ cron: { fields } })).toMatchObject({
      kind: ScheduledTaskTriggerDescriptionKind.Custom,
      expression: JSON.stringify(fields),
    });
  });

  it.each([undefined, null])(
    'describes minute-step schedules with an unset week (%s)',
    (week) => {
      const fields = {
        week,
        hour: '*',
        minute: '*/5',
      } as unknown as Record<string, string>;

      expect(describeScheduledTaskTrigger({ cron: { fields } })).toMatchObject({
        kind: ScheduledTaskTriggerDescriptionKind.EveryNMinutes,
        intervalMinutes: 5,
      });
    },
  );

  it('describes an hourly schedule by its two-digit minute', () => {
    expect(
      describeScheduledTaskTrigger(
        { cron: { fields: { hour: '*', minute: '5' } } },
        { timezone: 'Asia/Kathmandu' },
      ),
    ).toMatchObject({
      kind: ScheduledTaskTriggerDescriptionKind.Hourly,
      time: '05',
    });
  });

  it('describes the 31st as a monthly schedule', () => {
    expect(
      describeScheduledTaskTrigger({
        cron: { fields: { hour: '23', minute: '30', day: '31' } },
      }),
    ).toMatchObject({
      kind: ScheduledTaskTriggerDescriptionKind.Monthly,
      dayOfMonth: '31',
      time: '23:30',
    });
  });

  it('keeps the last-day-of-month expression as a custom expression', () => {
    const fields = { hour: '21', minute: '30', day: 'last' };

    expect(describeScheduledTaskTrigger({ cron: { fields } })).toMatchObject({
      kind: ScheduledTaskTriggerDescriptionKind.Custom,
      expression: JSON.stringify(fields),
    });
  });

  it('reads an offset-less one-time date as zone-local wall time', () => {
    expect(
      describeScheduledTaskTrigger(
        { date: '2026-07-24T09:00:00' },
        { timezone: 'Asia/Tokyo' },
      ),
    ).toMatchObject({
      kind: ScheduledTaskTriggerDescriptionKind.OneTime,
      dateTime: '2026-07-24T09:00',
    });
  });

  it('shows an absolute one-time instant in the task zone', () => {
    expect(
      describeScheduledTaskTrigger(
        { date: '2026-07-24T07:00:00.000Z' },
        { timezone: 'Europe/Berlin' },
      ),
    ).toMatchObject({ dateTime: '2026-07-24T09:00' });
  });

  it('defaults to UTC for a task without a zone', () => {
    expect(
      describeScheduledTaskTrigger({
        cron: { fields: { hour: '9', minute: '0' } },
      }).timezone,
    ).toBe('UTC');
  });

  it('rejects numeric values outside valid ranges', () => {
    expect(
      describeScheduledTaskTrigger({
        cron: { fields: { hour: '25', minute: '0' } },
      }).kind,
    ).toBe(ScheduledTaskTriggerDescriptionKind.Invalid);
  });

  it('does not require unrelated task metadata for a weekly schedule', () => {
    expect(
      describeScheduledTaskTrigger({
        cron: { fields: { hour: '9', minute: '30', day_of_week: '0' } },
      }),
    ).toMatchObject({
      kind: ScheduledTaskTriggerDescriptionKind.Weekly,
      time: '09:30',
      dayOfWeek: '0',
    });
  });

  it('keeps unsupported expressions displayable as custom and rejects invalid dates', () => {
    expect(
      describeScheduledTaskTrigger({
        cron: { fields: { hour: '*/2', minute: '0' } },
      }),
    ).toMatchObject({ kind: ScheduledTaskTriggerDescriptionKind.Custom });
    expect(describeScheduledTaskTrigger({ date: 'invalid' }).kind).toBe(
      ScheduledTaskTriggerDescriptionKind.Invalid,
    );
  });
});
