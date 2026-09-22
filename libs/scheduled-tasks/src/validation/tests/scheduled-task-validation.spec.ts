import {
  ScheduledTaskValidationErrorCode,
  validateScheduledTaskFormValues,
} from '../index';
import {
  ScheduledTaskRepeat,
  type ScheduledTaskCreateFormValues,
} from '../../index';
import { describe, expect, it } from 'vitest';

const now = new Date('2026-09-22T10:00:00.000Z');
const values: ScheduledTaskCreateFormValues = {
  displayName: 'Daily review',
  modelId: 'model-1',
  prompt: 'Review the day',
  repeat: ScheduledTaskRepeat.Daily,
  time: '09:00',
};

describe('validateScheduledTaskFormValues', () => {
  it('reports required common fields as stable codes', () => {
    expect(
      validateScheduledTaskFormValues(
        { ...values, displayName: ' ', modelId: '', prompt: ' ' },
        { now },
      ),
    ).toEqual({
      displayName: ScheduledTaskValidationErrorCode.DisplayNameRequired,
      modelId: ScheduledTaskValidationErrorCode.ModelRequired,
      prompt: ScheduledTaskValidationErrorCode.PromptRequired,
    });
  });

  it('rejects empty or out-of-range weekly and monthly fields', () => {
    expect(
      validateScheduledTaskFormValues(
        { ...values, repeat: ScheduledTaskRepeat.Weekly, dayOfWeek: '' },
        { now },
      ).dayOfWeek,
    ).toBe(ScheduledTaskValidationErrorCode.DayOfWeekInvalid);
    expect(
      validateScheduledTaskFormValues(
        { ...values, repeat: ScheduledTaskRepeat.Monthly, dayOfMonth: '32' },
        { now },
      ).dayOfMonth,
    ).toBe(ScheduledTaskValidationErrorCode.DayOfMonthInvalid);
  });

  it('uses the injected clock and validates only active fields', () => {
    expect(
      validateScheduledTaskFormValues(
        {
          ...values,
          repeat: ScheduledTaskRepeat.OneTime,
          runAt: '2026-09-22T10:00',
          time: 'bad',
          dayOfWeek: '9',
        },
        { now },
      ),
    ).toEqual({ runAt: ScheduledTaskValidationErrorCode.RunAtInvalid });
  });

  it('validates cadence boundaries and activity windows', () => {
    expect(
      validateScheduledTaskFormValues(
        { ...values, repeat: ScheduledTaskRepeat.Hourly, minute: '60' },
        { now },
      ).minute,
    ).toBe(ScheduledTaskValidationErrorCode.MinuteInvalid);
    expect(
      validateScheduledTaskFormValues(
        {
          ...values,
          time: '24:00',
          startDate: '2026-02-30',
          endDate: '2026-01-01',
        },
        { now },
      ),
    ).toMatchObject({
      time: ScheduledTaskValidationErrorCode.TimeInvalid,
      startDate: ScheduledTaskValidationErrorCode.StartDateInvalid,
    });
  });
});
