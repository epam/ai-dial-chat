import type {
  ConversationListItemDto,
  ScheduledTaskRunDto,
} from '@epam/ai-dial-chat-api-client';
import { ScheduledTaskRunStatus } from '@epam/ai-dial-scheduled-tasks';
import type { TFunction } from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduledTasksI18nKeys } from '../../constants/translation-keys';
import {
  findMatchingConversation,
  formatRunDuration,
  mapScheduledTaskRunDtoToItem,
  mapScheduledTaskRunDtosToItems,
} from '../map-scheduled-task-run-dto';

const fakeT = ((key: string, options?: Record<string, unknown>): string =>
  options ? `${key}:${JSON.stringify(options)}` : key) as TFunction;

const DURATION_TEMPLATES: Record<string, string> = {
  [ScheduledTasksI18nKeys.DetailHistoryDurationSuffix]: '({{duration}})',
  [ScheduledTasksI18nKeys.DetailHistoryDurationHours]: '{{count}}h',
  [ScheduledTasksI18nKeys.DetailHistoryDurationMinutes]: '{{count}}m',
  [ScheduledTasksI18nKeys.DetailHistoryDurationSeconds]: '{{count}}s',
};

// Resolves duration keys to their English templates so assertions read as display text.
const durationT = ((key: string, options?: Record<string, unknown>): string =>
  (DURATION_TEMPLATES[key] ?? key).replace(/{{(\w+)}}/g, (_, name: string) =>
    String(options?.[name]),
  )) as TFunction;

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

describe('mapScheduledTaskRunDtoToItem', () => {
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
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ status: upstreamStatus }),
      fakeT,
      [],
    );

    expect(result.status).toBe(expected);
  });

  it('falls back to Missed for an unrecognized upstream status', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ status: 'something-unexpected' as never }),
      fakeT,
      [],
    );

    expect(result.status).toBe(ScheduledTaskRunStatus.Missed);
  });

  it('preserves the run id', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ id: 'run_42' }),
      fakeT,
      [],
    );

    expect(result.id).toBe('run_42');
  });

  it('formats a same-day startTime via the "today" translation key', () => {
    const result = mapScheduledTaskRunDtoToItem(buildRunDto(), fakeT, []);

    expect(result.timestampLabel).toMatch(
      new RegExp(`^${ScheduledTasksI18nKeys.DetailHistoryTodayAt}:`),
    );
  });

  it('formats a different-day startTime via the "date" translation key', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ startTime: '2026-07-17T09:01:00.000Z' }),
      fakeT,
      [],
    );

    expect(result.timestampLabel).toMatch(
      new RegExp(`^${ScheduledTasksI18nKeys.DetailHistoryDateAt}:`),
    );
  });

  it('appends a duration suffix when durationSeconds is present', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ durationSeconds: 99 }),
      fakeT,
      [],
    );

    expect(result.timestampLabel).toContain(
      `${ScheduledTasksI18nKeys.DetailHistoryDurationSuffix}:`,
    );
  });

  it('omits the duration suffix when durationSeconds is absent (e.g. an in-progress run)', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ status: 'InProgress', durationSeconds: undefined }),
      fakeT,
      [],
    );

    expect(result.timestampLabel).not.toContain(
      ScheduledTasksI18nKeys.DetailHistoryDurationSuffix,
    );
  });

  it('copies conversationId through from the dto', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ conversationId: 'conversations/bucket/c1' }),
      fakeT,
      [],
    );

    expect(result.conversationId).toBe('conversations/bucket/c1');
  });

  it('copies errorText through from the dto', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ errorText: 'target request failed with status 502' }),
      fakeT,
      [],
    );

    expect(result.errorText).toBe('target request failed with status 502');
  });

  it('leaves conversationId undefined when the dto omits it', () => {
    const result = mapScheduledTaskRunDtoToItem(buildRunDto(), fakeT, []);

    expect(result.conversationId).toBeUndefined();
  });

  it('resolves isUnread true when the matched conversation is unread', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({
        conversationId: 'conversations/bucket/.scheduler/sched_123/run_1',
      }),
      fakeT,
      [buildConversation({ isUnread: true })],
    );

    expect(result.isUnread).toBe(true);
  });

  it('resolves isUnread false when the matched conversation is read', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({
        conversationId: 'conversations/bucket/.scheduler/sched_123/run_1',
      }),
      fakeT,
      [buildConversation({ isUnread: false })],
    );

    expect(result.isUnread).toBe(false);
  });

  it('resolves isUnread false when no conversation matches', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ conversationId: 'conversations/bucket/other' }),
      fakeT,
      [buildConversation({ isUnread: true })],
    );

    expect(result.isUnread).toBe(false);
  });

  it('resolves isUnread false when the run has no conversationId', () => {
    const result = mapScheduledTaskRunDtoToItem(buildRunDto(), fakeT, [
      buildConversation({ isUnread: true }),
    ]);

    expect(result.isUnread).toBe(false);
  });
});

describe('formatRunDuration', () => {
  it.each([
    [45, '(45s)'],
    [0, '(0s)'],
  ])(
    'keeps durations under one minute in seconds (%i → %s)',
    (seconds, label) => {
      expect(formatRunDuration(seconds, durationT)).toBe(label);
    },
  );

  it.each([
    [61, '(1m 1s)'],
    [99, '(1m 39s)'],
  ])(
    'shows durations of 60 seconds or more in minutes and seconds (%i → %s)',
    (seconds, label) => {
      expect(formatRunDuration(seconds, durationT)).toBe(label);
    },
  );

  it.each([
    [60, '(1m)'],
    [3600, '(1h)'],
    [3605, '(1h 5s)'],
  ])('omits zero-valued units (%i → %s)', (seconds, label) => {
    expect(formatRunDuration(seconds, durationT)).toBe(label);
  });

  it.each([
    [3723, '(1h 2m 3s)'],
    [90180, '(25h 3m)'],
  ])(
    'includes hours for durations of an hour or more, without a days unit (%i → %s)',
    (seconds, label) => {
      expect(formatRunDuration(seconds, durationT)).toBe(label);
    },
  );

  it('returns undefined when the duration is absent', () => {
    expect(formatRunDuration(undefined, durationT)).toBeUndefined();
  });
});

describe('mapScheduledTaskRunDtosToItems', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'UTC');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maps every dto in the list, preserving order', () => {
    const result = mapScheduledTaskRunDtosToItems(
      [buildRunDto({ id: 'run_1' }), buildRunDto({ id: 'run_2' })],
      fakeT,
      [],
    );

    expect(result.map((item) => item.id)).toEqual(['run_1', 'run_2']);
  });

  it('maps an empty list to an empty array', () => {
    expect(mapScheduledTaskRunDtosToItems([], fakeT, [])).toEqual([]);
  });
});

describe('findMatchingConversation', () => {
  it('matches ids that differ only by the conversations/ resource prefix', () => {
    const conversations = [
      buildConversation({ id: 'bucket/.scheduler/sched_123/run_1' }),
    ];

    const result = findMatchingConversation(
      'conversations/bucket/.scheduler/sched_123/run_1',
      conversations,
    );

    expect(result).toBe(conversations[0]);
  });

  it('returns undefined when conversationId is undefined', () => {
    expect(
      findMatchingConversation(undefined, [buildConversation()]),
    ).toBeUndefined();
  });

  it('returns undefined when no conversation matches', () => {
    expect(
      findMatchingConversation('conversations/bucket/other', [
        buildConversation(),
      ]),
    ).toBeUndefined();
  });
});
