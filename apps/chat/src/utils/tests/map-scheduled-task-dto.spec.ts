import type { ScheduledTaskDto } from '@epam/chat-api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { ScheduledTasksI18nKeys } from '../../constants/translation-keys';
import {
  mapScheduledTaskDtoToItem,
  mapScheduledTaskDtosToItems,
} from '../map-scheduled-task-dto';

const fakeT = ((key: string, options?: Record<string, unknown>): string =>
  options ? `${key}:${JSON.stringify(options)}` : key) as TFunction;

const buildDto = (overrides?: Partial<ScheduledTaskDto>): ScheduledTaskDto => ({
  id: 'sched_1',
  displayName: 'Daily summary',
  trigger: { date: '2026-07-24T09:00:00.000Z' },
  ...overrides,
});

describe('mapScheduledTaskDtoToItem', () => {
  it('formats a date trigger via the once translation key with a locale-formatted date', () => {
    const result = mapScheduledTaskDtoToItem(buildDto(), fakeT);

    expect(result.id).toBe('sched_1');
    expect(result.displayName).toBe('Daily summary');
    expect(result.scheduleLabel).toMatch(
      new RegExp(`^${ScheduledTasksI18nKeys.CardScheduleOnceAt}:`),
    );
    expect(result.sortValues.nextRunAt).toBe('2026-07-24T09:00:00.000Z');
  });

  it('formats a weekly cron trigger via the weekly translation key', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({
        trigger: {
          cron: { fields: { hour: '9', minute: '0', day_of_week: 'Monday' } },
        },
      }),
      fakeT,
    );

    expect(result.scheduleLabel).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleWeeklyAt}:${JSON.stringify({ day: 'Monday', time: '09:00' })}`,
    );
  });

  it('formats a monthly cron trigger via the monthly translation key', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({
        trigger: {
          cron: { fields: { hour: '9', minute: '0', day: '15' } },
        },
      }),
      fakeT,
    );

    expect(result.scheduleLabel).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleMonthlyAt}:${JSON.stringify({ day: '15', time: '09:00' })}`,
    );
  });

  it('formats a plain daily cron trigger via the daily translation key', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ trigger: { cron: { fields: { hour: '9', minute: '0' } } } }),
      fakeT,
    );

    expect(result.scheduleLabel).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleDailyAt}:${JSON.stringify({ time: '09:00' })}`,
    );
  });

  it('falls back to a generic recurring label when cron fields lack hour/minute', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ trigger: { cron: { fields: {} } } }),
      fakeT,
    );

    expect(result.scheduleLabel).toBe(
      ScheduledTasksI18nKeys.CardScheduleRecurringFallback,
    );
  });

  it('formats an hourly cron trigger (no hour field) via the hourly translation key', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ trigger: { cron: { fields: { minute: '0' } } } }),
      fakeT,
    );

    expect(result.scheduleLabel).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleHourlyAt}:${JSON.stringify({ minute: '00' })}`,
    );
  });

  it('formats an every-N-minutes cron trigger via the every-N-minutes translation key', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ trigger: { cron: { fields: { minute: '*/15' } } } }),
      fakeT,
    );

    expect(result.scheduleLabel).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleEveryNMinutes}:${JSON.stringify({ count: 15 })}`,
    );
  });

  it('falls back to the generic recurring label when hour is a wildcard with no minute', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ trigger: { cron: { fields: { hour: '*' } } } }),
      fakeT,
    );

    expect(result.scheduleLabel).toBe(
      ScheduledTasksI18nKeys.CardScheduleRecurringFallback,
    );
  });

  it('prefers nextRunTime/createdAt from the DTO over the create-trigger date', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({
        nextRunTime: '2026-07-28T12:00:00.000Z',
        createdAt: '2026-07-23T21:27:07.000Z',
      }),
      fakeT,
    );

    expect(result.sortValues.nextRunAt).toBe('2026-07-28T12:00:00.000Z');
    expect(result.sortValues.createdAt).toBe('2026-07-23T21:27:07.000Z');
  });

  it('falls back to myTasks with no thrown errors for missing optional fields', () => {
    const result = mapScheduledTaskDtoToItem(buildDto(), fakeT);

    expect(result.sectionKey).toBe('myTasks');
    expect(result.descriptionPreview).toBeUndefined();
    expect(result.locationSegments).toBeUndefined();
  });

  it('maps description to descriptionPreview unmodified', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ description: 'Summarizes unread inbox items every morning' }),
      fakeT,
    );

    expect(result.descriptionPreview).toBe(
      'Summarizes unread inbox items every morning',
    );
  });

  it('places the item under myTasks when createdBy matches currentUserSub', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ createdBy: 'user-1' }),
      fakeT,
      'user-1',
    );

    expect(result.sectionKey).toBe('myTasks');
  });

  it('places the item under shared when createdBy differs from currentUserSub', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ createdBy: 'user-2' }),
      fakeT,
      'user-1',
    );

    expect(result.sectionKey).toBe('shared');
  });

  it('falls back to myTasks when createdBy is present but currentUserSub is not supplied', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ createdBy: 'user-2' }),
      fakeT,
    );

    expect(result.sectionKey).toBe('myTasks');
  });
});

describe('mapScheduledTaskDtosToItems', () => {
  it('maps every dto in the list, preserving order', () => {
    const result = mapScheduledTaskDtosToItems(
      [buildDto({ id: '1' }), buildDto({ id: '2' })],
      fakeT,
    );

    expect(result.map((item) => item.id)).toEqual(['1', '2']);
  });
});
