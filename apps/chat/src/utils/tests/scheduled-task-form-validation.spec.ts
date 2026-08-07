import {
  ScheduledTaskCreateFormValues,
  ScheduledTaskFrequency,
  ScheduledTaskScheduleType,
} from '@epam/ai-dial-scheduled-tasks';
import { describe, expect, it } from 'vitest';
import { validateScheduledTaskForm } from '../scheduled-task-form-validation';

const t = ((key: string) => key) as Parameters<
  typeof validateScheduledTaskForm
>[1];

const baseValues: ScheduledTaskCreateFormValues = {
  displayName: 'Daily summary',
  scheduleType: ScheduledTaskScheduleType.Once,
  runAt: new Date(Date.now() + 3_600_000).toISOString(),
  time: '09:00',
  modelId: 'gpt-4o',
  prompt: 'Summarize my inbox',
};

describe('validateScheduledTaskForm', () => {
  it('returns no errors for valid once-schedule values', () => {
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

  it('requires a future runAt for a once schedule', () => {
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

  it('validates time format for a recurring schedule', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        scheduleType: ScheduledTaskScheduleType.Recurring,
        frequency: ScheduledTaskFrequency.Daily,
        time: '25:99',
      },
      t,
    );
    expect(errors.time).toBeDefined();
  });

  it('requires dayOfWeek for a weekly recurring schedule', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        scheduleType: ScheduledTaskScheduleType.Recurring,
        frequency: ScheduledTaskFrequency.Weekly,
      },
      t,
    );
    expect(errors.dayOfWeek).toBeDefined();
  });

  it('requires dayOfMonth for a monthly recurring schedule', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        scheduleType: ScheduledTaskScheduleType.Recurring,
        frequency: ScheduledTaskFrequency.Monthly,
      },
      t,
    );
    expect(errors.dayOfMonth).toBeDefined();
  });

  it('rejects an endDate that is not after startDate', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        scheduleType: ScheduledTaskScheduleType.Recurring,
        frequency: ScheduledTaskFrequency.Daily,
        startDate: '2026-08-31',
        endDate: '2026-08-01',
      },
      t,
    );
    expect(errors.endDate).toBeDefined();
  });

  it('accepts a valid recurring schedule with a bounded activity window', () => {
    const errors = validateScheduledTaskForm(
      {
        ...baseValues,
        scheduleType: ScheduledTaskScheduleType.Recurring,
        frequency: ScheduledTaskFrequency.Daily,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      },
      t,
    );
    expect(errors).toEqual({});
  });
});
