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

  it('converts fractional timezone offsets and weekday rollover deterministically', () => {
    const options = {
      timeZone: 'Asia/Kathmandu',
      referenceDate: new Date('2026-09-21T12:00:00Z'),
    };
    expect(
      describeScheduledTaskTrigger(
        { cron: { fields: { hour: '23', minute: '30', day_of_week: '0' } } },
        options,
      ),
    ).toMatchObject({ time: '05:15', dayOfWeek: '1' });
    expect(
      describeScheduledTaskTrigger(
        { cron: { fields: { hour: '*', minute: '0' } } },
        options,
      ),
    ).toMatchObject({ time: '45' });
    expect(
      describeScheduledTaskTrigger(
        { cron: { fields: { hour: '23', minute: '30', day: '31' } } },
        options,
      ).kind,
    ).toBe(ScheduledTaskTriggerDescriptionKind.Custom);
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
