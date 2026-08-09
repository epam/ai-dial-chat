import {
  ScheduledTaskCreateFormValues,
  ScheduledTaskRepeat,
} from '@epam/ai-dial-scheduled-tasks';
import type { ScheduledTaskDto } from '@epam/chat-api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsupportedTriggerReason } from '../../types/scheduled-task-mapping';
import {
  mapFormValuesToCreateBody,
  mapFormValuesToUpdateBody,
  mapScheduledTaskDtoToFormValues,
} from '../scheduled-task-trigger';

const baseDto: ScheduledTaskDto = {
  id: 'sched_123',
  displayName: 'Daily summary',
  model: 'gpt-4o',
  prompt: 'Summarize my inbox',
  trigger: {},
};

const baseValues: ScheduledTaskCreateFormValues = {
  displayName: 'Daily summary',
  repeat: ScheduledTaskRepeat.OneTime,
  time: '09:00',
  modelId: 'gpt-4o',
  prompt: 'Summarize my inbox',
};

describe('mapFormValuesToCreateBody', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'UTC');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maps a one-time repeat to trigger.date', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.OneTime,
      runAt: '2026-07-24T09:00',
    });

    expect(body.trigger.date).toBe(new Date('2026-07-24T09:00').toISOString());
    expect(body.trigger.cron).toBeUndefined();
  });

  it('maps an hourly repeat to a wildcard hour with the user-selected minute', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.Hourly,
      minute: '15',
    });

    expect(body.trigger.date).toBeUndefined();
    expect(body.trigger.cron?.fields).toEqual({ hour: '*', minute: '15' });
  });

  it('maps a daily repeat to trigger.cron.fields', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.Daily,
      time: '09:00',
    });

    expect(body.trigger.date).toBeUndefined();
    expect(body.trigger.cron?.fields).toEqual({ hour: '9', minute: '0' });
  });

  it('maps a weekly repeat with day_of_week', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.Weekly,
      time: '14:30',
      dayOfWeek: '1',
    });

    expect(body.trigger.cron?.fields).toEqual({
      hour: '14',
      minute: '30',
      day_of_week: '1',
    });
  });

  it('maps a monthly repeat with day', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.Monthly,
      time: '00:05',
      dayOfMonth: '15',
    });

    expect(body.trigger.cron?.fields).toEqual({
      hour: '0',
      minute: '5',
      day: '15',
    });
  });

  it('carries displayName, model, and prompt through', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.Daily,
    });

    expect(body.displayName).toBe('Daily summary');
    expect(body.model).toBe('gpt-4o');
    expect(body.prompt).toBe('Summarize my inbox');
    expect(body).not.toHaveProperty('stream');
  });

  it('includes a trimmed description when non-empty', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.OneTime,
      runAt: '2026-07-24T09:00',
      description: '  Summarizes unread inbox items  ',
    });

    expect(body.description).toBe('Summarizes unread inbox items');
  });

  it('omits description when empty', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.OneTime,
      runAt: '2026-07-24T09:00',
      description: '',
    });

    expect(body.description).toBeUndefined();
  });

  it('omits description when whitespace-only', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.OneTime,
      runAt: '2026-07-24T09:00',
      description: '   ',
    });

    expect(body.description).toBeUndefined();
  });

  it('omits description when not provided', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.OneTime,
      runAt: '2026-07-24T09:00',
    });

    expect(body.description).toBeUndefined();
  });

  it('omits startDate/endDate from trigger.cron when neither is set', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.Daily,
    });

    expect(body.trigger.cron).not.toHaveProperty('startDate');
    expect(body.trigger.cron).not.toHaveProperty('endDate');
  });

  it('never includes startDate/endDate for a one-time repeat even if present in values', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.OneTime,
      runAt: '2026-07-24T09:00',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });

    expect(body.trigger.cron).toBeUndefined();
    expect(body.trigger).not.toHaveProperty('startDate');
    expect(body.trigger).not.toHaveProperty('endDate');
  });

  it('includes startDate/endDate for an hourly repeat, same as any other recurring cadence', () => {
    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.Hourly,
      minute: '0',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });

    expect(body.trigger.cron?.fields).toEqual({ hour: '*', minute: '0' });
    expect(body.trigger.cron?.startDate).toBe('2026-08-01T00:00:00.000Z');
    expect(body.trigger.cron?.endDate).toBe('2026-08-31T23:59:59.999Z');
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
      repeat: ScheduledTaskRepeat.Daily,
      time: '09:00',
    });

    expect(body.trigger.cron?.fields).toEqual({ hour: '7', minute: '0' });
  });

  it('shifts day_of_week forward when the UTC conversion crosses midnight', () => {
    vi.stubEnv('TZ', 'America/New_York'); // UTC-4 in summer: UTC = local + 4h

    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.Weekly,
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
      repeat: ScheduledTaskRepeat.Weekly,
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
      repeat: ScheduledTaskRepeat.Daily,
      time: '09:00',
    });

    expect(body.trigger.cron?.fields).toEqual({ hour: '9', minute: '0' });
  });

  it('converts a monthly local day/time to its UTC equivalent with no rollover', () => {
    vi.stubEnv('TZ', 'Europe/Warsaw'); // UTC+2 in summer

    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.Monthly,
      time: '09:00',
      dayOfMonth: '15',
    });

    expect(body.trigger.cron?.fields).toEqual({
      hour: '7',
      minute: '0',
      day: '15',
    });
  });

  it('does not shift the hourly minute at a whole-hour-offset timezone', () => {
    vi.stubEnv('TZ', 'Europe/Warsaw'); // UTC+2 in summer (whole-hour offset)

    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.Hourly,
      minute: '15',
    });

    expect(body.trigger.cron?.fields).toEqual({ hour: '*', minute: '15' });
  });

  it('shifts the hourly minute at a sub-hour-offset timezone', () => {
    vi.stubEnv('TZ', 'Asia/Kolkata'); // UTC+5:30

    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.Hourly,
      minute: '15',
    });

    expect(body.trigger.cron?.fields).toEqual({ hour: '*', minute: '45' });
  });

  it('converts startDate/endDate to UTC start/end-of-local-day at a non-zero offset', () => {
    vi.stubEnv('TZ', 'Europe/Warsaw'); // UTC+2 in summer

    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.Daily,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });

    expect(body.trigger.cron?.startDate).toBe('2026-07-31T22:00:00.000Z');
    expect(body.trigger.cron?.endDate).toBe('2026-08-31T21:59:59.999Z');
  });

  it('applies the offset in effect on each boundary day across a DST transition', () => {
    // Poland's DST ends 2026-10-25: Oct 1 is UTC+2 (CEST), Nov 1 is UTC+1 (CET).
    vi.stubEnv('TZ', 'Europe/Warsaw');

    const body = mapFormValuesToCreateBody({
      ...baseValues,
      repeat: ScheduledTaskRepeat.Daily,
      startDate: '2026-10-01',
      endDate: '2026-11-01',
    });

    expect(body.trigger.cron?.startDate).toBe('2026-09-30T22:00:00.000Z');
    expect(body.trigger.cron?.endDate).toBe('2026-11-01T22:59:59.999Z');
  });
});

describe('mapFormValuesToUpdateBody', () => {
  it('maps values to the same shape as mapFormValuesToCreateBody', () => {
    const values: ScheduledTaskCreateFormValues = {
      displayName: 'Daily summary',
      repeat: ScheduledTaskRepeat.OneTime,
      time: '09:00',
      runAt: '2026-07-24T09:00',
      modelId: 'gpt-4o',
      prompt: 'Summarize my inbox',
    };

    expect(mapFormValuesToUpdateBody(values)).toEqual(
      mapFormValuesToCreateBody(values),
    );
  });
});

describe('mapScheduledTaskDtoToFormValues', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails closed when model is missing', () => {
    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      model: undefined,
      trigger: { date: '2026-07-24T09:00:00.000Z' },
    });

    expect(result).toEqual({
      ok: false,
      reason: UnsupportedTriggerReason.MissingRequiredFields,
    });
  });

  it('fails closed when prompt is missing', () => {
    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      prompt: undefined,
      trigger: { date: '2026-07-24T09:00:00.000Z' },
    });

    expect(result).toEqual({
      ok: false,
      reason: UnsupportedTriggerReason.MissingRequiredFields,
    });
  });

  it('fails closed when neither trigger.date nor trigger.cron is set', () => {
    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: {},
    });

    expect(result).toEqual({
      ok: false,
      reason: UnsupportedTriggerReason.UnsupportedTriggerType,
    });
  });

  it('fails closed when both trigger.date and trigger.cron are set', () => {
    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: {
        date: '2026-07-24T09:00:00.000Z',
        cron: { fields: { hour: '9', minute: '0' } },
      },
    });

    expect(result).toEqual({
      ok: false,
      reason: UnsupportedTriggerReason.UnsupportedTriggerType,
    });
  });

  it('fails closed on a cron shape with an unsupported field key', () => {
    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: { cron: { fields: { hour: '9', minute: '0', week: '2' } } },
    });

    expect(result).toEqual({
      ok: false,
      reason: UnsupportedTriggerReason.UnsupportedCronShape,
    });
  });

  it('treats null-valued cron fields as absent, not as unsupported extra keys', () => {
    // DIAL Scheduler always returns every cron field key, using `null` for
    // unset ones — this must round-trip like a plain daily schedule.
    vi.stubEnv('TZ', 'Europe/Warsaw'); // UTC+2 in summer

    const fields = {
      day: null,
      hour: '9',
      week: null,
      year: null,
      month: null,
      minute: '0',
      second: null,
      day_of_week: null,
    } as unknown as Record<string, string>;

    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: { cron: { fields } },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.repeat).toBe(ScheduledTaskRepeat.Daily);
      expect(result.values.time).toBe('11:00');
      expect(result.values.dayOfWeek).toBeUndefined();
      expect(result.values.dayOfMonth).toBeUndefined();
    }
  });

  it('fails closed when both day_of_week and day are present', () => {
    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: {
        cron: {
          fields: { hour: '9', minute: '0', day_of_week: '0', day: '1' },
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      reason: UnsupportedTriggerReason.UnsupportedCronShape,
    });
  });

  it('fails closed when hour is `*` combined with a set day_of_week', () => {
    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: {
        cron: { fields: { hour: '*', minute: '0', day_of_week: '0' } },
      },
    });

    expect(result).toEqual({
      ok: false,
      reason: UnsupportedTriggerReason.UnsupportedCronShape,
    });
  });

  it('round-trips a one-time schedule back to local runAt', () => {
    vi.stubEnv('TZ', 'Europe/Warsaw'); // UTC+2 in summer

    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: { date: '2026-07-24T07:00:00.000Z' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.repeat).toBe(ScheduledTaskRepeat.OneTime);
      expect(result.values.runAt).toBe('2026-07-24T09:00');
      // Not '00:00' — switching Repeat to a time-based cadence on the edit
      // page must not silently start from midnight.
      expect(result.values.time).toBe('09:00');
    }
  });

  it('round-trips an hourly schedule at a whole-hour-offset timezone with no minute shift', () => {
    vi.stubEnv('TZ', 'Europe/Warsaw'); // UTC+2 in summer

    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: { cron: { fields: { hour: '*', minute: '15' } } },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.repeat).toBe(ScheduledTaskRepeat.Hourly);
      expect(result.values.minute).toBe('15');
      // Not '00:00' — switching Repeat to a time-based cadence on the edit
      // page must not silently start from midnight.
      expect(result.values.time).toBe('09:00');
      expect(result.values.dayOfWeek).toBeUndefined();
      expect(result.values.dayOfMonth).toBeUndefined();
    }
  });

  it('round-trips an hourly schedule at a sub-hour-offset timezone with a minute shift', () => {
    vi.stubEnv('TZ', 'Asia/Kolkata'); // UTC+5:30

    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: { cron: { fields: { hour: '*', minute: '45' } } },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.repeat).toBe(ScheduledTaskRepeat.Hourly);
      expect(result.values.minute).toBe('15');
    }
  });

  it('round-trips a daily recurring schedule back to local time', () => {
    vi.stubEnv('TZ', 'Europe/Warsaw'); // UTC+2 in summer

    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: { cron: { fields: { hour: '7', minute: '0' } } },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.repeat).toBe(ScheduledTaskRepeat.Daily);
      expect(result.values.time).toBe('09:00');
    }
  });

  it('round-trips a monthly recurring schedule back to local time and day', () => {
    vi.stubEnv('TZ', 'Europe/Warsaw'); // UTC+2 in summer

    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: { cron: { fields: { hour: '7', minute: '0', day: '15' } } },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.repeat).toBe(ScheduledTaskRepeat.Monthly);
      expect(result.values.time).toBe('09:00');
      expect(result.values.dayOfMonth).toBe('15');
    }
  });

  it('round-trips a weekly recurring schedule, shifting day_of_week back across a UTC day boundary', () => {
    vi.stubEnv('TZ', 'America/New_York'); // UTC-4 in summer

    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: {
        cron: { fields: { hour: '2', minute: '0', day_of_week: '1' } }, // Tuesday UTC
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.repeat).toBe(ScheduledTaskRepeat.Weekly);
      expect(result.values.time).toBe('22:00');
      expect(result.values.dayOfWeek).toBe('0'); // Monday, APScheduler convention
    }
  });

  it('round-trips activity-window startDate/endDate to local date-only values', () => {
    vi.stubEnv('TZ', 'Europe/Warsaw'); // UTC+2 in summer

    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: {
        cron: {
          fields: { hour: '7', minute: '0' },
          startDate: '2026-07-31T22:00:00.000Z',
          endDate: '2026-08-31T21:59:59.999Z',
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.startDate).toBe('2026-08-01');
      expect(result.values.endDate).toBe('2026-08-31');
    }
  });

  it('round-trips activity-window startDate/endDate for an hourly schedule', () => {
    vi.stubEnv('TZ', 'Europe/Warsaw'); // UTC+2 in summer

    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: {
        cron: {
          fields: { hour: '*', minute: '0' },
          startDate: '2026-07-31T22:00:00.000Z',
          endDate: '2026-08-31T21:59:59.999Z',
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.repeat).toBe(ScheduledTaskRepeat.Hourly);
      expect(result.values.startDate).toBe('2026-08-01');
      expect(result.values.endDate).toBe('2026-08-31');
    }
  });

  it('round-trips activity-window boundaries across a DST transition without drift', () => {
    // Poland's DST ends 2026-10-25: Oct 1 is UTC+2 (CEST), Nov 1 is UTC+1 (CET).
    vi.stubEnv('TZ', 'Europe/Warsaw');

    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      trigger: {
        cron: {
          fields: { hour: '7', minute: '0' },
          startDate: '2026-09-30T22:00:00.000Z',
          endDate: '2026-11-01T22:59:59.999Z',
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.startDate).toBe('2026-10-01');
      expect(result.values.endDate).toBe('2026-11-01');
    }
  });

  it('carries displayName, model, prompt, and description through', () => {
    const result = mapScheduledTaskDtoToFormValues({
      ...baseDto,
      description: 'Summarizes unread inbox items',
      trigger: { date: '2026-07-24T09:00:00.000Z' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.displayName).toBe('Daily summary');
      expect(result.values.modelId).toBe('gpt-4o');
      expect(result.values.prompt).toBe('Summarize my inbox');
      expect(result.values.description).toBe('Summarizes unread inbox items');
    }
  });
});
