import {
  ScheduledTaskCreateFormValues,
  ScheduledTaskRepeat,
} from '@epam/ai-dial-scheduled-tasks';
import { describe, expect, it } from 'vitest';
import { ScheduledTasksI18nKeys } from '../../constants/translation-keys';
import { validateScheduledTaskForm } from '../scheduled-task-form-validation';

const t = ((key: string) => key) as Parameters<
  typeof validateScheduledTaskForm
>[1];

/* `validateScheduledTaskForm` reads the real clock, so window boundaries are
   built runtime-relative — a hardcoded date becomes a past date the day after
   it is written. */
const localDateOnly = (offsetDays: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const baseValues: ScheduledTaskCreateFormValues = {
  displayName: 'Daily summary',
  repeat: ScheduledTaskRepeat.OneTime,
  runAt: new Date(Date.now() + 3_600_000).toISOString(),
  time: '09:00',
  modelId: 'gpt-4o',
  prompt: 'Summarize my inbox',
};

describe('validateScheduledTaskForm', () => {
  it('reports a start-date error for a malformed recurring start date', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Daily,
        startDate: 'invalid',
      },
      t,
    );
    expect(errors.startDate).toBe(
      ScheduledTasksI18nKeys.CreateStartDateInvalid,
    );
    expect(errors.runAt).toBeUndefined();
  });

  it('reports the run-at error for a malformed one-time date', () => {
    const errors = validateScheduledTaskForm(
      { ...baseValues, runAt: 'invalid' },
      t,
    );
    expect(errors.runAt).toBe(ScheduledTasksI18nKeys.CreateRunAtRequired);
  });

  it('returns no errors for valid one-time repeat values', () => {
    expect(validateScheduledTaskForm(baseValues, t)).toEqual({});
  });

  it('requires displayName', () => {
    const errors = validateScheduledTaskForm(
      { ...baseValues, displayName: '  ' },
      t,
    );
    expect(errors.displayName).toBeDefined();
  });

  it('requires modelId', () => {
    const errors = validateScheduledTaskForm({ ...baseValues, modelId: '' }, t);
    expect(errors.modelId).toBeDefined();
  });

  it('requires prompt', () => {
    const errors = validateScheduledTaskForm(
      { ...baseValues, prompt: '  ' },
      t,
    );
    expect(errors.prompt).toBeDefined();
  });

  it('rejects a description over 500 characters', () => {
    const errors = validateScheduledTaskForm(
      { ...baseValues, description: 'a'.repeat(501) },
      t,
    );
    expect(errors.description).toBeDefined();
  });

  it('requires a future runAt for a one-time repeat', () => {
    const errors = validateScheduledTaskForm(
      { ...baseValues, runAt: new Date(Date.now() - 60_000).toISOString() },
      t,
    );
    expect(errors.runAt).toBeDefined();
  });

  it('rejects a runAt inside the minimum lead time', () => {
    const errors = validateScheduledTaskForm(
      { ...baseValues, runAt: new Date(Date.now() + 1_000).toISOString() },
      t,
    );
    expect(errors.runAt).toBeDefined();
  });

  it('validates time format for a daily repeat', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Daily,
        time: '25:99',
      },
      t,
    );
    expect(errors.time).toBeDefined();
  });

  it('requires dayOfWeek for a weekly repeat', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Weekly,
      },
      t,
    );
    expect(errors.dayOfWeek).toBeDefined();
  });

  it('requires dayOfMonth for a monthly repeat', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Monthly,
      },
      t,
    );
    expect(errors.dayOfMonth).toBeDefined();
  });

  it('does not require a time value for an hourly repeat', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Hourly,
        time: '',
        minute: '0',
      },
      t,
    );
    expect(errors.time).toBeUndefined();
  });

  it('requires a valid minute for an hourly repeat', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Hourly,
        time: '',
        minute: '',
      },
      t,
    );
    expect(errors.minute).toBeDefined();
  });

  it('rejects a minute value out of the 0-59 range', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Hourly,
        time: '',
        minute: '60',
      },
      t,
    );
    expect(errors.minute).toBeDefined();
  });

  it('accepts a valid hourly repeat with a minute and no time, dayOfWeek, or dayOfMonth', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Hourly,
        time: '',
        minute: '30',
      },
      t,
    );
    expect(errors).toEqual({});
  });

  it('rejects an endDate that is not after startDate', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Daily,
        startDate: localDateOnly(10),
        endDate: localDateOnly(5),
      },
      t,
    );
    expect(errors.endDate).toBeDefined();
  });

  it('rejects a startDate earlier than today', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Daily,
        startDate: localDateOnly(-1),
      },
      t,
    );
    expect(errors.startDate).toBe(ScheduledTasksI18nKeys.CreateStartDateInPast);
  });

  it('rejects an endDate earlier than today', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Daily,
        endDate: localDateOnly(-1),
      },
      t,
    );
    expect(errors.endDate).toBe(ScheduledTasksI18nKeys.CreateEndDateInPast);
  });

  it('accepts a valid recurring schedule with a bounded activity window', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Daily,
        startDate: localDateOnly(1),
        endDate: localDateOnly(10),
      },
      t,
    );
    expect(errors).toEqual({});
  });

  it('accepts a window starting on today', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Daily,
        startDate: localDateOnly(0),
        endDate: localDateOnly(10),
      },
      t,
    );
    expect(errors).toEqual({});
  });

  it('accepts an hourly repeat with a bounded activity window', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Hourly,
        time: '',
        minute: '0',
        startDate: localDateOnly(1),
        endDate: localDateOnly(10),
      },
      t,
    );
    expect(errors).toEqual({});
  });
});
