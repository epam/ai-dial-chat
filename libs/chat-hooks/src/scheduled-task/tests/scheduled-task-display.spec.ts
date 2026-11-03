import {
  ScheduledTaskErrorCode,
  type ConversationListItemDto,
  type ScheduledTaskDto,
  type ScheduledTaskRunDto,
} from '@epam/ai-dial-chat-api-client';
import { ScheduledTaskRunStatus } from '@epam/ai-dial-scheduled-tasks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyScheduledTaskDeleteError,
  formatScheduledTaskRunDuration,
  formatScheduledTaskRunTimestamp,
  formatScheduledTaskScheduleLabel,
  ScheduledTaskDeleteErrorKind,
  selectScheduledTaskErrorMessage,
  toScheduledTaskItem,
  toScheduledTaskItems,
  toScheduledTaskRunItem,
  toScheduledTaskRunItems,
  type ScheduledTaskRunDurationLabels,
  type ScheduledTaskRunItemOptions,
  type ScheduledTaskRunTimestampLabels,
  type ScheduledTaskScheduleLabels,
} from '../scheduled-task-display';

/* Echoes each formatter's name and arguments so assertions read the values the host receives. */
const scheduleLabels: ScheduledTaskScheduleLabels = {
  onceAt: (date) => `onceAt:${date}`,
  everyNMinutes: (count) => `everyNMinutes:${count}`,
  hourlyAt: (minute) => `hourlyAt:${minute}`,
  dailyAt: (time) => `dailyAt:${time}`,
  weeklyAt: (day, time) => `weeklyAt:${day}|${time}`,
  everyNWeeks: (count, day, time) => `everyNWeeks:${count}|${day}|${time}`,
  monthlyAt: (day, time) => `monthlyAt:${day}|${time}`,
  invalid: 'invalid',
  recurringFallback: 'recurringFallback',
};

const durationLabels: ScheduledTaskRunDurationLabels = {
  hours: (count) => `${count}h`,
  minutes: (count) => `${count}m`,
  seconds: (count) => `${count}s`,
  suffix: (duration) => `(${duration})`,
};

const timestampLabels: ScheduledTaskRunTimestampLabels = {
  todayAt: (time) => `todayAt:${time}`,
  dateAt: (date, time) => `dateAt:${date}|${time}`,
};

/* Stand-in for a host's id comparison: tolerates the `conversations/` resource prefix. */
const conversationIdsMatch = (left: string, right: string): boolean =>
  left.replace(/^conversations\//, '') ===
  right.replace(/^conversations\//, '');

const buildDto = (overrides?: Partial<ScheduledTaskDto>): ScheduledTaskDto => ({
  id: 'sched_1',
  displayName: 'Daily summary',
  trigger: { date: '2026-07-24T09:00:00.000Z' },
  ...overrides,
});

const buildRunDto = (
  overrides?: Partial<ScheduledTaskRunDto>,
): ScheduledTaskRunDto => ({
  id: 'run_1',
  status: 'Success',
  startTime: '2026-07-24T09:01:00.000Z',
  ...overrides,
});

const buildConversation = (
  overrides?: Partial<ConversationListItemDto>,
): ConversationListItemDto =>
  ({
    id: 'bucket/.scheduler/sched_123/run_1',
    isUnread: false,
    ...overrides,
  }) as ConversationListItemDto;

const runOptions = (
  overrides?: Partial<ScheduledTaskRunItemOptions>,
): ScheduledTaskRunItemOptions => ({
  timestampLabels,
  durationLabels,
  conversations: [],
  conversationIdsMatch,
  ...overrides,
});

const mockBrowserTimeZone = (timeZone: string) => {
  const options = new Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...options,
    timeZone,
  });
};

describe('toScheduledTaskItem', () => {
  beforeEach(() => {
    mockBrowserTimeZone('UTC');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats a date trigger through onceAt with a locale-formatted date', () => {
    const result = toScheduledTaskItem(buildDto(), scheduleLabels);

    expect(result.id).toBe('sched_1');
    expect(result.displayName).toBe('Daily summary');
    expect(result.scheduleLabel).toMatch(/^onceAt:/);
  });

  it('uses the supplied locale for dates and weekdays throughout list mapping', () => {
    const items = toScheduledTaskItems(
      [
        buildDto(),
        buildDto({
          trigger: {
            cron: { fields: { hour: '9', minute: '0', day_of_week: 'Monday' } },
          },
        }),
      ],
      scheduleLabels,
      { locale: 'fr' },
    );

    expect(items[0].scheduleLabel).toBe(
      `onceAt:${new Intl.DateTimeFormat('fr', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date('2026-07-24T09:00:00.000Z'))}`,
    );
    expect(items[1].scheduleLabel).toBe('weeklyAt:lundi|09:00');
  });

  it('formats a weekly cron trigger through weeklyAt', () => {
    const result = toScheduledTaskItem(
      buildDto({
        trigger: {
          cron: { fields: { hour: '9', minute: '0', day_of_week: 'Monday' } },
        },
      }),
      scheduleLabels,
      { locale: 'en' },
    );

    expect(result.scheduleLabel).toBe('weeklyAt:Monday|09:00');
  });

  it('formats an every-N-weeks cron trigger through everyNWeeks', () => {
    const result = toScheduledTaskItem(
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
      scheduleLabels,
      { locale: 'en' },
    );

    expect(result.scheduleLabel).toBe('everyNWeeks:2|Tuesday|09:00');
  });

  it('falls back to the recurring label for a week expression outside the editor range', () => {
    const result = toScheduledTaskItem(
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
      scheduleLabels,
      { locale: 'en' },
    );

    expect(result.scheduleLabel).toBe('recurringFallback');
  });

  it('formats a monthly cron trigger through monthlyAt', () => {
    const result = toScheduledTaskItem(
      buildDto({
        trigger: { cron: { fields: { hour: '9', minute: '0', day: '15' } } },
      }),
      scheduleLabels,
    );

    expect(result.scheduleLabel).toBe('monthlyAt:15|09:00');
  });

  it('formats a plain daily cron trigger through dailyAt', () => {
    const result = toScheduledTaskItem(
      buildDto({ trigger: { cron: { fields: { hour: '9', minute: '0' } } } }),
      scheduleLabels,
    );

    expect(result.scheduleLabel).toBe('dailyAt:09:00');
  });

  it('shows the invalid label when cron fields are empty', () => {
    const result = toScheduledTaskItem(
      buildDto({ trigger: { cron: { fields: {} } } }),
      scheduleLabels,
    );

    expect(result.scheduleLabel).toBe('invalid');
  });

  it('formats an hourly cron trigger (no hour field) through hourlyAt', () => {
    const result = toScheduledTaskItem(
      buildDto({ trigger: { cron: { fields: { minute: '0' } } } }),
      scheduleLabels,
    );

    expect(result.scheduleLabel).toBe('hourlyAt:00');
  });

  it('formats an every-N-minutes cron trigger through everyNMinutes', () => {
    const result = toScheduledTaskItem(
      buildDto({ trigger: { cron: { fields: { minute: '*/15' } } } }),
      scheduleLabels,
    );

    expect(result.scheduleLabel).toBe('everyNMinutes:15');
  });

  it('falls back to the recurring label when hour is a wildcard with no minute', () => {
    const result = toScheduledTaskItem(
      buildDto({ trigger: { cron: { fields: { hour: '*' } } } }),
      scheduleLabels,
    );

    expect(result.scheduleLabel).toBe('recurringFallback');
  });

  it('leaves missing optional fields undefined with no thrown errors', () => {
    const result = toScheduledTaskItem(buildDto(), scheduleLabels);

    expect(result.descriptionPreview).toBeUndefined();
    expect(result.locationSegments).toBeUndefined();
    expect(result.isActive).toBeUndefined();
    expect(result.isCompleted).toBeUndefined();
  });

  it('maps description, isActive and isCompleted unmodified', () => {
    const description = 'x'.repeat(500);
    const result = toScheduledTaskItem(
      buildDto({ description, isActive: false, isCompleted: true }),
      scheduleLabels,
    );

    expect(result.descriptionPreview).toBe(description);
    expect(result.isActive).toBe(false);
    expect(result.isCompleted).toBe(true);
  });

  it('maps isActive true and isCompleted false unmodified', () => {
    const result = toScheduledTaskItem(
      buildDto({ isActive: true, isCompleted: false }),
      scheduleLabels,
    );

    expect(result.isActive).toBe(true);
    expect(result.isCompleted).toBe(false);
  });
});

describe('formatScheduledTaskScheduleLabel — timezone conversion', () => {
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

      expect(
        formatScheduledTaskScheduleLabel(
          buildDto({
            trigger: { cron: { fields: { hour: '7', minute: '0' } } },
          }),
          scheduleLabels,
        ),
      ).toBe(`dailyAt:${time}`);
    },
  );

  it('uses an explicit timeZone instead of the browser timezone', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00.000Z'));

    expect(
      formatScheduledTaskScheduleLabel(
        buildDto({ trigger: { cron: { fields: { hour: '7', minute: '0' } } } }),
        scheduleLabels,
        { timeZone: 'UTC' },
      ),
    ).toBe('dailyAt:07:00');
  });

  it('shows the local weekday when the stored UTC day rolls forward a day', () => {
    expect(
      formatScheduledTaskScheduleLabel(
        buildDto({
          trigger: {
            cron: { fields: { hour: '23', minute: '0', day_of_week: '6' } }, // UTC Sunday
          },
        }),
        scheduleLabels,
        { locale: 'en' },
      ),
    ).toBe('weeklyAt:Monday|01:00'); // local Monday 01:00
  });

  it('formats a named weekday with its local time', () => {
    expect(
      formatScheduledTaskScheduleLabel(
        buildDto({
          trigger: {
            cron: { fields: { hour: '9', minute: '0', day_of_week: 'Monday' } },
          },
        }),
        scheduleLabels,
        { locale: 'en' },
      ),
    ).toBe('weeklyAt:Monday|11:00');
  });

  it('shows the local day-of-month when the stored UTC day rolls forward a day', () => {
    expect(
      formatScheduledTaskScheduleLabel(
        buildDto({
          trigger: { cron: { fields: { hour: '23', minute: '0', day: '14' } } }, // UTC day 14
        }),
        scheduleLabels,
      ),
    ).toBe('monthlyAt:15|01:00'); // local day 15
  });
});

describe('toScheduledTaskItems', () => {
  it('maps every dto in the list, preserving order', () => {
    const result = toScheduledTaskItems(
      [buildDto({ id: '1' }), buildDto({ id: '2' })],
      scheduleLabels,
    );

    expect(result.map((item) => item.id)).toEqual(['1', '2']);
  });
});

describe('toScheduledTaskRunItem', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'UTC');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T20:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each([
    ['Success', ScheduledTaskRunStatus.Success],
    ['Error', ScheduledTaskRunStatus.Error],
    ['InProgress', ScheduledTaskRunStatus.InProgress],
    ['Missed', ScheduledTaskRunStatus.Missed],
  ] as const)('maps upstream status %s to %s', (upstreamStatus, expected) => {
    expect(
      toScheduledTaskRunItem(
        buildRunDto({ status: upstreamStatus }),
        runOptions(),
      ).status,
    ).toBe(expected);
  });

  it('falls back to Missed for an unrecognized upstream status', () => {
    expect(
      toScheduledTaskRunItem(
        buildRunDto({ status: 'something-unexpected' as never }),
        runOptions(),
      ).status,
    ).toBe(ScheduledTaskRunStatus.Missed);
  });

  it('preserves the run id, conversationId and errorText', () => {
    const result = toScheduledTaskRunItem(
      buildRunDto({
        id: 'run_42',
        conversationId: 'conversations/bucket/c1',
        errorText: 'target request failed with status 502',
      }),
      runOptions(),
    );

    expect(result.id).toBe('run_42');
    expect(result.conversationId).toBe('conversations/bucket/c1');
    expect(result.errorText).toBe('target request failed with status 502');
  });

  it('leaves conversationId undefined when the dto omits it', () => {
    expect(
      toScheduledTaskRunItem(buildRunDto(), runOptions()).conversationId,
    ).toBeUndefined();
  });

  it('formats a same-day startTime through todayAt', () => {
    expect(
      toScheduledTaskRunItem(buildRunDto(), runOptions()).timestampLabel,
    ).toMatch(/^todayAt:/);
  });

  it('formats a different-day startTime through dateAt', () => {
    expect(
      toScheduledTaskRunItem(
        buildRunDto({ startTime: '2026-07-17T09:01:00.000Z' }),
        runOptions(),
      ).timestampLabel,
    ).toMatch(/^dateAt:/);
  });

  it('maps durationSeconds to a separate durationLabel, keeping it out of timestampLabel', () => {
    const result = toScheduledTaskRunItem(
      buildRunDto({ durationSeconds: 99 }),
      runOptions(),
    );

    expect(result.durationLabel).toBe('(1m 39s)');
    expect(result.timestampLabel).not.toContain('(1m 39s)');
  });

  it('leaves durationLabel undefined when durationSeconds is absent (e.g. an in-progress run)', () => {
    expect(
      toScheduledTaskRunItem(
        buildRunDto({ status: 'InProgress', durationSeconds: undefined }),
        runOptions(),
      ).durationLabel,
    ).toBeUndefined();
  });

  it('resolves isUnread true when the matched conversation is unread', () => {
    expect(
      toScheduledTaskRunItem(
        buildRunDto({
          conversationId: 'conversations/bucket/.scheduler/sched_123/run_1',
        }),
        runOptions({ conversations: [buildConversation({ isUnread: true })] }),
      ).isUnread,
    ).toBe(true);
  });

  it('resolves isUnread false when the matched conversation is read', () => {
    expect(
      toScheduledTaskRunItem(
        buildRunDto({
          conversationId: 'conversations/bucket/.scheduler/sched_123/run_1',
        }),
        runOptions({ conversations: [buildConversation({ isUnread: false })] }),
      ).isUnread,
    ).toBe(false);
  });

  it('resolves isUnread false when no conversation matches', () => {
    expect(
      toScheduledTaskRunItem(
        buildRunDto({ conversationId: 'conversations/bucket/other' }),
        runOptions({ conversations: [buildConversation({ isUnread: true })] }),
      ).isUnread,
    ).toBe(false);
  });

  it('resolves isUnread false when the run has no conversationId', () => {
    expect(
      toScheduledTaskRunItem(
        buildRunDto(),
        runOptions({ conversations: [buildConversation({ isUnread: true })] }),
      ).isUnread,
    ).toBe(false);
  });

  it("uses the host's id comparison to resolve isUnread", () => {
    const run = buildRunDto({ conversationId: 'conversations/bucket/a' });
    const conversations = [
      buildConversation({ id: 'bucket/a', isUnread: true }),
    ];

    expect(
      toScheduledTaskRunItem(run, runOptions({ conversations })).isUnread,
    ).toBe(true);
    expect(
      toScheduledTaskRunItem(
        run,
        runOptions({ conversations, conversationIdsMatch: () => false }),
      ).isUnread,
    ).toBe(false);
  });
});

describe('formatScheduledTaskRunTimestamp', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'UTC');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses todayAt for a start on the same day as now, without calling dateAt', () => {
    const dateAt = vi.fn(() => 'dateAt');

    expect(
      formatScheduledTaskRunTimestamp(
        '2026-07-24T09:01:00.000Z',
        undefined,
        { ...timestampLabels, dateAt },
        { now: new Date('2026-07-24T20:00:00.000Z') },
      ),
    ).toMatch(/^todayAt:/);
    expect(dateAt).not.toHaveBeenCalled();
  });

  it('appends the duration when durationSeconds and durationLabels are present', () => {
    expect(
      formatScheduledTaskRunTimestamp(
        '2026-07-17T09:01:00.000Z',
        99,
        timestampLabels,
        { durationLabels, now: new Date('2026-07-24T20:00:00.000Z') },
      ),
    ).toMatch(/^dateAt:.* \(1m 39s\)$/);
  });

  it('omits the duration when no durationLabels are supplied', () => {
    expect(
      formatScheduledTaskRunTimestamp(
        '2026-07-17T09:01:00.000Z',
        99,
        timestampLabels,
        {
          now: new Date('2026-07-24T20:00:00.000Z'),
        },
      ),
    ).not.toContain('(');
  });
});

describe('formatScheduledTaskRunDuration', () => {
  it.each([
    [45, '(45s)'],
    [0, '(0s)'],
  ])(
    'keeps durations under one minute in seconds (%i → %s)',
    (seconds, label) => {
      expect(formatScheduledTaskRunDuration(seconds, durationLabels)).toBe(
        label,
      );
    },
  );

  it.each([
    [61, '(1m 1s)'],
    [99, '(1m 39s)'],
  ])(
    'shows durations of 60 seconds or more in minutes and seconds (%i → %s)',
    (seconds, label) => {
      expect(formatScheduledTaskRunDuration(seconds, durationLabels)).toBe(
        label,
      );
    },
  );

  it.each([
    [60, '(1m)'],
    [3600, '(1h)'],
    [3605, '(1h 5s)'],
  ])('omits zero-valued units (%i → %s)', (seconds, label) => {
    expect(formatScheduledTaskRunDuration(seconds, durationLabels)).toBe(label);
  });

  it.each([
    [3723, '(1h 2m 3s)'],
    [90180, '(25h 3m)'],
  ])(
    'includes hours for durations of an hour or more, without a days unit (%i → %s)',
    (seconds, label) => {
      expect(formatScheduledTaskRunDuration(seconds, durationLabels)).toBe(
        label,
      );
    },
  );

  it.each([undefined, null])(
    'returns undefined when the duration is %s',
    (value) => {
      expect(
        formatScheduledTaskRunDuration(value, durationLabels),
      ).toBeUndefined();
    },
  );
});

describe('toScheduledTaskRunItems', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'UTC');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maps every dto in the list, preserving order', () => {
    expect(
      toScheduledTaskRunItems(
        [buildRunDto({ id: 'run_1' }), buildRunDto({ id: 'run_2' })],
        runOptions(),
      ).map((item) => item.id),
    ).toEqual(['run_1', 'run_2']);
  });

  it('maps an empty list to an empty array', () => {
    expect(toScheduledTaskRunItems([], runOptions())).toEqual([]);
  });
});

describe('classifyScheduledTaskDeleteError', () => {
  it.each([
    [404, ScheduledTaskDeleteErrorKind.NotFound],
    [409, ScheduledTaskDeleteErrorKind.NotFound],
    [502, ScheduledTaskDeleteErrorKind.Retryable],
    [500, ScheduledTaskDeleteErrorKind.Generic],
    [undefined, ScheduledTaskDeleteErrorKind.Generic],
  ])('classifies status %s as %s', (status, kind) => {
    expect(classifyScheduledTaskDeleteError(status)).toBe(kind);
  });
});

describe('selectScheduledTaskErrorMessage', () => {
  const messages = { adminConsentRequired: 'consent', fallback: 'fallback' };

  it('prefers the admin-consent message over any upstream reason', () => {
    expect(
      selectScheduledTaskErrorMessage(
        {
          code: ScheduledTaskErrorCode.ScheduledTaskAdminConsentRequired,
          upstreamMessage: 'Application consent revoked',
        },
        messages,
      ),
    ).toBe('consent');
  });

  it("shows DIAL Scheduler's trimmed reason when there is no known code", () => {
    expect(
      selectScheduledTaskErrorMessage(
        {
          code: ScheduledTaskErrorCode.ScheduledTaskSkillUnsupported,
          upstreamMessage: ' Quota exceeded for schedules ',
        },
        messages,
      ),
    ).toBe('Quota exceeded for schedules');
  });

  it.each([undefined, '', '   '])(
    'falls back for upstream reason %j',
    (upstreamMessage) => {
      expect(
        selectScheduledTaskErrorMessage({ upstreamMessage }, messages),
      ).toBe('fallback');
    },
  );
});
