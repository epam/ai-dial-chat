import {
  ScheduledTaskRepeat,
  type ScheduledTaskCreateFormValues,
} from '@epam/ai-dial-scheduled-tasks';
import { ScheduledTaskValidationErrorCode } from '@epam/ai-dial-scheduled-tasks/validation';
import { describe, expect, it } from 'vitest';
import {
  prepareScheduledTaskCreateBody,
  prepareScheduledTaskUpdateBody,
} from '../scheduled-task-preparation';

const values: ScheduledTaskCreateFormValues = {
  displayName: 'Monthly review',
  modelId: 'model-1',
  prompt: 'Review',
  repeat: ScheduledTaskRepeat.Monthly,
  time: '09:15',
  dayOfMonth: '1',
};
const options = { now: new Date('2026-09-22T10:00:00.000Z') };

describe('scheduled task request preparation', () => {
  it('fails closed instead of serializing an empty monthly day', () => {
    expect(
      prepareScheduledTaskCreateBody({ ...values, dayOfMonth: '' }, options),
    ).toEqual({
      ok: false,
      errors: {
        dayOfMonth: ScheduledTaskValidationErrorCode.DayOfMonthInvalid,
      },
    });
  });

  it('returns a request body only for valid values', () => {
    const result = prepareScheduledTaskCreateBody(values, options);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.trigger.cron?.fields.day).toBe('1');
  });

  it('uses the same checks for updates', () => {
    expect(
      prepareScheduledTaskUpdateBody(
        { ...values, repeat: ScheduledTaskRepeat.Weekly, dayOfWeek: undefined },
        options,
      ),
    ).toMatchObject({
      ok: false,
      errors: { dayOfWeek: ScheduledTaskValidationErrorCode.DayOfWeekInvalid },
    });
  });
});
