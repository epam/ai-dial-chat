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
  buildActiveWindowLabel,
  buildNextRunLabel,
  buildScheduleLabel,
  getDeleteErrorMessageKey,
  mapScheduledTaskDtoToItem,
  mapScheduledTaskDtosToItems,
  resolveScheduledTaskErrorMessage,
} from '../map-scheduled-task-dto';

/*
 * The schedule rules themselves are covered by
 * libs/chat-hooks/src/scheduled-task/tests/scheduled-task-display.spec.ts;
 * these cases prove each formatter reaches `t` with the app's key and options.
 */
const fakeT = ((key: string, options?: Record<string, unknown>): string =>
  options ? `${key}:${JSON.stringify(options)}` : key) as TFunction;

const buildDto = (overrides?: Partial<ScheduledTaskDto>): ScheduledTaskDto => ({
  id: 'sched_1',
  displayName: 'Daily summary',
  trigger: { date: '2026-07-24T09:00:00.000Z' },
  ...overrides,
});

const cron = (fields: Record<string, string>): Partial<ScheduledTaskDto> => ({
  trigger: { cron: { fields } },
});

describe('buildScheduleLabel — zone suffix', () => {
  beforeEach(() => {
    const options = new Intl.DateTimeFormat().resolvedOptions();
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...options,
      timeZone: 'Europe/Berlin',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appends the task zone through the translated suffix when it differs from the browser zone', () => {
    expect(
      buildScheduleLabel(
        buildDto({
          timezone: 'Asia/Tokyo',
          ...cron({ hour: '9', minute: '0' }),
        }),
        fakeT,
        'en',
      ),
    ).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleZoneSuffix}:${JSON.stringify({
        label: `${ScheduledTasksI18nKeys.CardScheduleDailyAt}:${JSON.stringify({ time: '9:00 AM' })}`,
        timezone: 'Asia/Tokyo',
      })}`,
    );
  });

  it('appends the task zone even when it equals the browser zone if alwaysShowTimezone is set', () => {
    expect(
      buildScheduleLabel(
        buildDto({
          timezone: 'Europe/Berlin',
          ...cron({ hour: '9', minute: '0' }),
        }),
        fakeT,
        'en',
        true,
      ),
    ).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleZoneSuffix}:${JSON.stringify({
        label: `${ScheduledTasksI18nKeys.CardScheduleDailyAt}:${JSON.stringify({ time: '9:00 AM' })}`,
        timezone: 'Europe/Berlin',
      })}`,
    );
  });

  it('leaves the label alone when the task is in the browser zone', () => {
    expect(
      buildScheduleLabel(
        buildDto({
          timezone: 'Europe/Berlin',
          ...cron({ hour: '9', minute: '0' }),
        }),
        fakeT,
        'en',
      ),
    ).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleDailyAt}:${JSON.stringify({ time: '9:00 AM' })}`,
    );
  });
});

describe('buildScheduleLabel', () => {
  beforeEach(() => {
    const options = new Intl.DateTimeFormat().resolvedOptions();
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...options,
      timeZone: 'UTC',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes a locale-formatted date to the once key', () => {
    expect(buildScheduleLabel(buildDto(), fakeT, 'fr')).toBe(
      `${ScheduledTasksI18nKeys.CardScheduleOnceAt}:${JSON.stringify({
        date: new Intl.DateTimeFormat('fr', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'UTC',
        }).format(new Date('2026-07-24T09:00:00.000Z')),
      })}`,
    );
  });

  it.each([
    [
      cron({ minute: '*/15' }),
      ScheduledTasksI18nKeys.CardScheduleEveryNMinutes,
      { count: 15 },
    ],
    [
      cron({ minute: '0' }),
      ScheduledTasksI18nKeys.CardScheduleHourlyAt,
      { minute: '00' },
    ],
    [
      cron({ hour: '9', minute: '0' }),
      ScheduledTasksI18nKeys.CardScheduleDailyAt,
      { time: '9:00 AM' },
    ],
    [
      cron({ hour: '9', minute: '0', day_of_week: 'Monday' }),
      ScheduledTasksI18nKeys.CardScheduleWeeklyAt,
      { day: 'Monday', time: '9:00 AM' },
    ],
    [
      cron({ hour: '9', minute: '0', day_of_week: '0,2,4' }),
      ScheduledTasksI18nKeys.CardScheduleWeeklyAt,
      { day: 'Monday, Wednesday, and Friday', time: '9:00 AM' },
    ],
    [
      cron({ hour: '9', minute: '0', day: '15' }),
      ScheduledTasksI18nKeys.CardScheduleMonthlyAt,
      { day: '15', time: '9:00 AM' },
    ],
  ])(
    'renders a recurring trigger through %#: its key and options',
    (overrides, key, options) => {
      expect(buildScheduleLabel(buildDto(overrides), fakeT, 'en')).toBe(
        `${key}:${JSON.stringify(options)}`,
      );
    },
  );

  it('renders an unreadable trigger with the invalid key', () => {
    expect(buildScheduleLabel(buildDto(cron({})), fakeT)).toBe(
      ScheduledTasksI18nKeys.EditInvalidScheduleLabel,
    );
  });

  it('renders an unrecognized trigger with the recurring fallback key', () => {
    expect(buildScheduleLabel(buildDto(cron({ hour: '*' })), fakeT)).toBe(
      ScheduledTasksI18nKeys.CardScheduleRecurringFallback,
    );
  });
});

/** Interpolates the English templates these labels use, so assertions read like the UI. */
const EN_TEMPLATES: Record<string, string> = {
  [ScheduledTasksI18nKeys.CardScheduleZoneSuffix]: '{{label}} ({{timezone}})',
  [ScheduledTasksI18nKeys.DetailNextRunLabel]: 'Next run: {{value}}',
  [ScheduledTasksI18nKeys.DetailActiveWindowValue]:
    '{{startDate}} – {{endDate}}',
  [ScheduledTasksI18nKeys.CardScheduleOnceAt]: 'Once on {{date}}',
};
const enT = ((key: string, options?: Record<string, unknown>): string =>
  (EN_TEMPLATES[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(options?.[name] ?? ''),
  )) as TFunction;

/** ICU puts a narrow no-break space before AM/PM; compare with plain spaces. */
const plain = (value: string | undefined): string | undefined =>
  value?.replace(/[\u202f\u00a0]/g, ' ');

const mockBrowserTimezone = (timeZone: string | undefined): void => {
  const options = new Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...options,
    timeZone: timeZone as string,
  });
};

describe('buildNextRunLabel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the instant in the viewer's zone and names that zone, next to a Repeats label in the task's zone", () => {
    mockBrowserTimezone('Europe/Kyiv');
    const task = buildDto({
      timezone: 'Europe/Paris',
      trigger: { date: '2026-11-19T16:45' },
      nextRunTime: '2026-11-19T15:45:00.000Z',
    });

    expect(plain(buildNextRunLabel(task.nextRunTime ?? '', enT, 'en-US'))).toBe(
      'Next run: Nov 19, 2026, 5:45 PM (Europe/Kyiv)',
    );
    expect(plain(buildScheduleLabel(task, enT, 'en-US', true))).toBe(
      'Once on Nov 19, 2026, 4:45 PM (Europe/Paris)',
    );
  });

  it('formats the instant in an explicitly given viewer zone', () => {
    expect(
      plain(
        buildNextRunLabel(
          '2026-11-19T15:45:00.000Z',
          enT,
          'en-US',
          'America/New_York',
        ),
      ),
    ).toBe('Next run: Nov 19, 2026, 10:45 AM (America/New_York)');
  });

  it('omits the zone suffix when the browser zone cannot be resolved', () => {
    mockBrowserTimezone(undefined);
    const instant = '2026-11-19T15:45:00.000Z';

    expect(buildNextRunLabel(instant, enT, 'en-US')).toBe(
      `Next run: ${new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(instant))}`,
    );
  });
});

describe('buildActiveWindowLabel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("names the task's zone whatever the browser zone", () => {
    mockBrowserTimezone('Europe/Kyiv');

    expect(
      plain(
        buildActiveWindowLabel(
          {
            timezone: 'America/New_York',
            trigger: {
              cron: {
                fields: { hour: '9', minute: '0' },
                startDate: '2026-12-01T09:00',
                endDate: '2026-12-31T18:00',
              },
            },
          },
          enT,
          'en-US',
        ),
      ),
    ).toBe('Dec 1, 2026, 9:00 AM – Dec 31, 2026, 6:00 PM (America/New_York)');
  });

  it("still names the zone when the task is in the browser's zone", () => {
    mockBrowserTimezone('Europe/Berlin');

    expect(
      buildActiveWindowLabel(
        {
          timezone: 'Europe/Berlin',
          trigger: {
            cron: {
              fields: { hour: '9', minute: '0' },
              startDate: '2026-12-01T09:00',
              endDate: '2026-12-31T18:00',
            },
          },
        },
        enT,
        'en-US',
      ),
    ).toMatch(/ \(Europe\/Berlin\)$/);
  });

  it("starts at the next run, shown in the task's zone, when there is no start date", () => {
    expect(
      plain(
        buildActiveWindowLabel(
          {
            timezone: 'Europe/Paris',
            nextRunTime: '2026-11-19T15:45:00.000Z',
            trigger: {
              cron: {
                fields: { hour: '16', minute: '45' },
                endDate: '2026-11-30T18:00',
              },
            },
          },
          enT,
          'en-US',
        ),
      ),
    ).toBe('Nov 19, 2026, 4:45 PM – Nov 30, 2026, 6:00 PM (Europe/Paris)');
  });

  it('names UTC when the task has no zone', () => {
    expect(
      buildActiveWindowLabel(
        {
          trigger: {
            cron: {
              fields: { hour: '9', minute: '0' },
              startDate: '2026-12-01T09:00',
              endDate: '2026-12-31T18:00',
            },
          },
        },
        enT,
        'en-US',
      ),
    ).toMatch(/ \(UTC\)$/);
  });

  it('returns undefined when the window has no end date', () => {
    expect(
      buildActiveWindowLabel(
        { trigger: { cron: { fields: { hour: '9', minute: '0' } } } },
        enT,
        'en-US',
      ),
    ).toBeUndefined();
  });
});

describe('mapScheduledTaskDtoToItem', () => {
  beforeEach(() => {
    const options = new Intl.DateTimeFormat().resolvedOptions();
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...options,
      timeZone: 'UTC',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the item with the translated schedule label', () => {
    const result = mapScheduledTaskDtoToItem(
      buildDto({ description: 'Summary', isActive: true }),
      fakeT,
    );

    expect(result).toMatchObject({
      id: 'sched_1',
      displayName: 'Daily summary',
      descriptionPreview: 'Summary',
      isActive: true,
    });
    expect(result.scheduleLabel).toMatch(
      new RegExp(`^${ScheduledTasksI18nKeys.CardScheduleOnceAt}:`),
    );
  });
});

describe('mapScheduledTaskDtosToItems', () => {
  it('maps every dto in the list, preserving order', () => {
    expect(
      mapScheduledTaskDtosToItems(
        [buildDto({ id: '1' }), buildDto({ id: '2' })],
        fakeT,
      ).map((item) => item.id),
    ).toEqual(['1', '2']);
  });
});

describe('getDeleteErrorMessageKey', () => {
  it.each([
    [404, ScheduledTasksI18nKeys.DetailDeleteNotFoundError],
    [409, ScheduledTasksI18nKeys.DetailDeleteNotFoundError],
    [502, ScheduledTasksI18nKeys.DetailDeleteRetryableError],
    [500, ScheduledTasksI18nKeys.DetailDeleteGenericError],
    [undefined, ScheduledTasksI18nKeys.DetailDeleteGenericError],
  ])('maps status %s to %s', (status, key) => {
    expect(getDeleteErrorMessageKey(status)).toBe(key);
  });
});

describe('resolveScheduledTaskErrorMessage', () => {
  const t = ((key: string) => key) as TFunction;

  it('translates the admin-consent message for a revoked consent', () => {
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
        { upstreamMessage: ' Quota exceeded for schedules ' },
        ScheduledTasksI18nKeys.EditErrorNotification,
        t,
      ),
    ).toBe('Quota exceeded for schedules');
  });

  it('translates the page fallback key when the scheduler gave no reason', () => {
    expect(
      resolveScheduledTaskErrorMessage(
        { upstreamMessage: '   ' },
        ScheduledTasksI18nKeys.EditErrorNotification,
        t,
      ),
    ).toBe(ScheduledTasksI18nKeys.EditErrorNotification);
  });
});
