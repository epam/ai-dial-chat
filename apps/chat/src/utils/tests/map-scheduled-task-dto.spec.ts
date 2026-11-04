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
      { time: '09:00' },
    ],
    [
      cron({ hour: '9', minute: '0', day_of_week: 'Monday' }),
      ScheduledTasksI18nKeys.CardScheduleWeeklyAt,
      { day: 'Monday', time: '09:00' },
    ],
    [
      cron({ week: '*/2', hour: '9', minute: '0', day_of_week: 'Tuesday' }),
      ScheduledTasksI18nKeys.CardScheduleEveryNWeeks,
      { count: 2, day: 'Tuesday', time: '09:00' },
    ],
    [
      cron({ hour: '9', minute: '0', day: '15' }),
      ScheduledTasksI18nKeys.CardScheduleMonthlyAt,
      { day: '15', time: '09:00' },
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

describe('mapScheduledTaskDtoToItem', () => {
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
