import {
  ScheduledTaskCreateFormValues,
  ScheduledTaskFrequency,
  ScheduledTaskScheduleType,
} from '@epam/ai-dial-scheduled-tasks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  beforeEach(() => {
    vi.stubEnv('TZ', 'UTC');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

describe('mapFormValuesToCreateBody — recurring schedule timezone conversion', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('converts a daily local time to its UTC equivalent', () => {
    vi.stubEnv('TZ', 'Europe/Warsaw'); // UTC+2 in summer

    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Recurring,
      frequency: ScheduledTaskFrequency.Daily,
      time: '09:00',
    });

    expect(body.trigger.cron?.fields).toEqual({ hour: '7', minute: '0' });
  });

  it('shifts day_of_week forward when the UTC conversion crosses midnight', () => {
    vi.stubEnv('TZ', 'America/New_York'); // UTC-4 in summer: UTC = local + 4h

    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Recurring,
      frequency: ScheduledTaskFrequency.Weekly,
      time: '22:00',
      dayOfWeek: '0', // Monday, APScheduler convention
    });

    expect(body.trigger.cron?.fields).toEqual({
      hour: '2',
      minute: '0',
      day_of_week: '1', // Tuesday
    });
  });

  it('shifts day_of_week backward when the UTC conversion crosses midnight the other way', () => {
    vi.stubEnv('TZ', 'Europe/Warsaw'); // UTC+2 in summer: UTC = local - 2h

    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Recurring,
      frequency: ScheduledTaskFrequency.Weekly,
      time: '01:00',
      dayOfWeek: '0', // Monday, APScheduler convention
    });

    expect(body.trigger.cron?.fields).toEqual({
      hour: '23',
      minute: '0',
      day_of_week: '6', // Sunday
    });
  });

  it('produces no shift when the browser timezone is UTC', () => {
    vi.stubEnv('TZ', 'UTC');

    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Recurring,
      frequency: ScheduledTaskFrequency.Daily,
      time: '09:00',
    });

    expect(body.trigger.cron?.fields).toEqual({ hour: '9', minute: '0' });
  });

  it('converts a monthly local day/time to its UTC equivalent with no rollover', () => {
    vi.stubEnv('TZ', 'Europe/Warsaw'); // UTC+2 in summer

    const body = mapFormValuesToCreateBody({
      ...baseValues,
      scheduleType: ScheduledTaskScheduleType.Recurring,
      frequency: ScheduledTaskFrequency.Monthly,
      time: '09:00',
      dayOfMonth: '15',
    });

    expect(body.trigger.cron?.fields).toEqual({
      hour: '7',
      minute: '0',
      day: '15',
    });
  });
});
