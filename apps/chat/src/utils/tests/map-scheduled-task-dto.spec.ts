import {
  ScheduledTaskErrorCode,
  type ScheduledTaskDto,
} from '@epam/ai-dial-chat-api-client';
import type { TFunction } from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ScheduledTasksI18nKeys,
  ToolsetSigninI18nKeys,
} from '../../constants/translation-keys';
import {
  mapScheduledTaskDtoToItem,
  mapScheduledTaskDtosToItems,
  resolveScheduledTaskErrorMessage,
} from '../map-scheduled-task-dto';

const fakeT = ((key: string, options?: Record<string, unknown>): string =>
  options ? `${key}:${JSON.stringify(options)}` : key) as TFunction;

const buildDto = (overrides?: Partial<ScheduledTaskDto>): ScheduledTaskDto => ({
  id: 'sched_1',
  displayName: 'Daily summary',
  trigger: { date: '2026-07-24T09:00:00.000Z' },
  ...overrides,
});

const mockBrowserTimeZone = (timeZone: string) => {
  const options = new Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...options,
    timeZone,
  });
};

describe('mapScheduledTaskDtoToItem', () => {
  beforeEach(() => {
    mockBrowserTimeZone('UTC');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats a date trigger via the once translation key with a locale-formatted date', () => {
    const result = mapScheduledTaskDtoToItem(buildDto(), fakeT);

    expect(result.id).toBe('sched_1');
    expect(result.displayName).toBe('Daily summary');
    expect(result.scheduleLabel).toMatch(
      new RegExp(`^${ScheduledTasksI18nKeys.CardScheduleOnceAt}:`),
    );
  });

  it('uses the supplied locale for dates and weekdays throughout list mapping', () => {
    const dateTask = buildDto();
    const weeklyTask = buildDto({
      trigger: {
        cron: { fields: { hour: '9', minute: '0', day_of_week: 'Monday' } },
      },
    });
    const items = mapScheduledTaskDtosToItems(
      [dateTask, weeklyTask],
      fakeT,
      'fr',
    );
    expect(items[0].scheduleLabel).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleOnceAt}:${JSON.stringify({
        date: new Intl.DateTimeFormat('fr', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date('2026-07-24T09:00:00.000Z')),
      })}`,
    );
    expect(items[1].scheduleLabel).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleWeeklyAt}:${JSON.stringify({ day: 'lundi', time: '09:00' })}`,
    );
  });

  it('formats a weekly cron trigger via the weekly translation key', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({
        trigger: {
          cron: { fields: { hour: '9', minute: '0', day_of_week: 'Monday' } },
        },
      }),
      fakeT,
      'en',
    );

    expect(result.scheduleLabel).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleWeeklyAt}:${JSON.stringify({ day: 'Monday', time: '09:00' })}`,
    );
  });

  it('formats an every-N-weeks cron trigger via the every-N-weeks translation key', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({
        trigger: {
          cron: {
            fields: {
              week: '*/2',
              hour: '9',
              minute: '0',
              day_of_week: 'Tuesday',
            },
          },
        },
      }),
      fakeT,
      'en',
    );

    expect(result.scheduleLabel).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleEveryNWeeks}:${JSON.stringify({ count: 2, day: 'Tuesday', time: '09:00' })}`,
    );
  });

  it('falls back to the generic recurring label for a week expression outside the editor range', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({
        trigger: {
          cron: {
            fields: {
              week: '2-40',
              hour: '9',
              minute: '0',
              day_of_week: 'Tuesday',
            },
          },
        },
      }),
      fakeT,
      'en',
    );

    expect(result.scheduleLabel).toBe(
      ScheduledTasksI18nKeys.CardScheduleRecurringFallback,
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

  it('shows invalid schedule when cron fields are empty', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ trigger: { cron: { fields: {} } } }),
      fakeT,
    );

    expect(result.scheduleLabel).toBe(
      ScheduledTasksI18nKeys.EditInvalidScheduleLabel,
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

  it('leaves missing optional fields undefined with no thrown errors', () => {
    const result = mapScheduledTaskDtoToItem(buildDto(), fakeT);

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

  it('maps isActive false to the item unmodified', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ isActive: false }),
      fakeT,
    );

    expect(result.isActive).toBe(false);
  });

  it('maps isActive true to the item unmodified', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ isActive: true }),
      fakeT,
    );

    expect(result.isActive).toBe(true);
  });

  it('maps a missing isActive to undefined without throwing', () => {
    const result = mapScheduledTaskDtoToItem(buildDto(), fakeT);

    expect(result.isActive).toBeUndefined();
  });

  it('maps isCompleted true to the item unmodified', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ isCompleted: true, isActive: false }),
      fakeT,
    );

    expect(result.isCompleted).toBe(true);
    expect(result.isActive).toBe(false);
  });

  it('maps isCompleted false to the item unmodified', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ isCompleted: false }),
      fakeT,
    );

    expect(result.isCompleted).toBe(false);
  });

  it('maps a missing isCompleted to undefined without throwing', () => {
    const result = mapScheduledTaskDtoToItem(buildDto(), fakeT);

    expect(result.isCompleted).toBeUndefined();
  });
});

describe('mapScheduledTaskDtoToItem — recurring schedule timezone conversion', () => {
  beforeEach(() => {
    mockBrowserTimeZone('Europe/Warsaw');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-05T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    ['2026-08-05T12:00:00.000Z', '09:00'],
    ['2026-01-05T12:00:00.000Z', '08:00'],
  ])(
    'shows the local equivalent of a stored UTC daily time on %s',
    (referenceDate, time) => {
      vi.setSystemTime(new Date(referenceDate));

      const result = mapScheduledTaskDtoToItem(
        buildDto({ trigger: { cron: { fields: { hour: '7', minute: '0' } } } }),
        fakeT,
      );

      expect(result.scheduleLabel).toBe(
        `${ScheduledTasksI18nKeys.CardScheduleDailyAt}:${JSON.stringify({ time })}`,
      );
    },
  );

  it('shows the local weekday when the stored UTC day rolls forward a day', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({
        trigger: {
          cron: { fields: { hour: '23', minute: '0', day_of_week: '6' } }, // UTC Sunday
        },
      }),
      fakeT,
      'en',
    );

    expect(result.scheduleLabel).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleWeeklyAt}:${JSON.stringify({ day: 'Monday', time: '01:00' })}`, // local Monday 01:00
    );
  });

  it('formats a named weekday with its local time', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({
        trigger: {
          cron: { fields: { hour: '9', minute: '0', day_of_week: 'Monday' } },
        },
      }),
      fakeT,
      'en',
    );

    expect(result.scheduleLabel).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleWeeklyAt}:${JSON.stringify({ day: 'Monday', time: '11:00' })}`,
    );
  });

  it('shows the local day-of-month when the stored UTC day rolls forward a day', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({
        trigger: {
          cron: { fields: { hour: '23', minute: '0', day: '14' } }, // UTC day 14
        },
      }),
      fakeT,
    );

    expect(result.scheduleLabel).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleMonthlyAt}:${JSON.stringify({ day: '15', time: '01:00' })}`, // local day 15
    );
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

describe('resolveScheduledTaskErrorMessage', () => {
  const t = ((key: string) => key) as TFunction;

  it('prefers the admin-consent message over any upstream reason', () => {
    expect(
      resolveScheduledTaskErrorMessage(
        {
          code: ScheduledTaskErrorCode.ScheduledTaskAdminConsentRequired,
          upstreamMessage: 'Application consent revoked',
        },
        ScheduledTasksI18nKeys.CreateErrorNotification,
        t,
      ),
    ).toBe(ToolsetSigninI18nKeys.AdminConsentRequired);
  });

  it("shows DIAL Scheduler's reason when there is no known code", () => {
    expect(
      resolveScheduledTaskErrorMessage(
        {
          code: ScheduledTaskErrorCode.ScheduledTaskSkillUnsupported,
          upstreamMessage: ' Quota exceeded for schedules ',
        },
        ScheduledTasksI18nKeys.EditErrorNotification,
        t,
      ),
    ).toBe('Quota exceeded for schedules');
  });

  it.each([undefined, '', '   '])(
    'falls back to the localized page message for upstream reason %j',
    (upstreamMessage) => {
      expect(
        resolveScheduledTaskErrorMessage(
          { upstreamMessage },
          ScheduledTasksI18nKeys.EditErrorNotification,
          t,
        ),
      ).toBe(ScheduledTasksI18nKeys.EditErrorNotification);
    },
  );
});
