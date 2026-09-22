import {
  describeScheduledTaskTrigger,
  ScheduledTaskTriggerDescriptionKind,
} from '../scheduled-task-description';
import { describe, expect, it } from 'vitest';

describe('describeScheduledTaskTrigger', () => {
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
