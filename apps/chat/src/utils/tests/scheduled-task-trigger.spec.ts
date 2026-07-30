import {
  ScheduledTaskCreateFormValues,
  ScheduledTaskFrequency,
  ScheduledTaskScheduleType,
} from '@epam/ai-dial-scheduled-tasks';
import { describe, expect, it } from 'vitest';
import { mapFormValuesToCreateBody } from '../scheduled-task-trigger';

const baseValues: ScheduledTaskCreateFormValues = {
  displayName: 'Daily summary',
  scheduleType: ScheduledTaskScheduleType.Once,
  time: '09:00',
  modelId: 'gpt-4o',
  prompt: 'Summarize my inbox',
  stream: true,
};

describe('mapFormValuesToCreateBody', () => {
  it('maps a once schedule to trigger.date', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Once,
      runAt: '2026-07-24T09:00',
    });

    expect(body.trigger.date).toBe(new Date('2026-07-24T09:00').toISOString());
    expect(body.trigger.cron).toBeUndefined();
  });

  it('maps a daily recurring schedule to trigger.cron.fields', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Recurring,
      frequency: ScheduledTaskFrequency.Daily,
      time: '09:00',
    });

    expect(body.trigger.date).toBeUndefined();
    expect(body.trigger.cron?.fields).toEqual({ hour: '9', minute: '0' });
  });

  it('maps a weekly recurring schedule with day_of_week', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Recurring,
      frequency: ScheduledTaskFrequency.Weekly,
      time: '14:30',
      dayOfWeek: '1',
    });

    expect(body.trigger.cron?.fields).toEqual({
      hour: '14',
      minute: '30',
      day_of_week: '1',
    });
  });

  it('maps a monthly recurring schedule with day', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Recurring,
      frequency: ScheduledTaskFrequency.Monthly,
      time: '00:05',
      dayOfMonth: '15',
    });

    expect(body.trigger.cron?.fields).toEqual({
      hour: '0',
      minute: '5',
      day: '15',
    });
  });

  it('carries displayName, model, prompt, and stream through', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Recurring,
      frequency: ScheduledTaskFrequency.Daily,
    });

    expect(body.displayName).toBe('Daily summary');
    expect(body.model).toBe('gpt-4o');
    expect(body.prompt).toBe('Summarize my inbox');
    expect(body.stream).toBe(true);
  });

  it('includes a trimmed description when non-empty', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Once,
      runAt: '2026-07-24T09:00',
      description: '  Summarizes unread inbox items  ',
    });

    expect(body.description).toBe('Summarizes unread inbox items');
  });

  it('omits description when empty', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Once,
      runAt: '2026-07-24T09:00',
      description: '',
    });

    expect(body.description).toBeUndefined();
  });

  it('omits description when whitespace-only', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Once,
      runAt: '2026-07-24T09:00',
      description: '   ',
    });

    expect(body.description).toBeUndefined();
  });

  it('omits description when not provided', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Once,
      runAt: '2026-07-24T09:00',
    });

    expect(body.description).toBeUndefined();
  });
});
