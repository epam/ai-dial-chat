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
  formatRunTimestamp,
  mapScheduledTaskRunDtoToItem,
  mapScheduledTaskRunDtosToItems,
} from '../map-scheduled-task-run-dto';

/*
 * The run rules themselves are covered by
 * libs/chat-hooks/src/scheduled-task/tests/scheduled-task-display.spec.ts;
 * these cases prove each formatter reaches `t` with the app's key and options.
 */
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

describe('formatRunDuration', () => {
  it.each([
    [0, '(0s)'],
    [45, '(45s)'],
    [61, '(1m 1s)'],
    [3605, '(1h 5s)'],
  ])('renders %i seconds through the duration keys as %s', (seconds, label) => {
    expect(formatRunDuration(seconds, durationT)).toBe(label);
  });

  it('returns undefined when the duration is absent', () => {
    expect(formatRunDuration(undefined, durationT)).toBeUndefined();
  });
});

describe('formatRunTimestamp', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'UTC');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T20:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('passes the short time to the today key', () => {
    const time = new Intl.DateTimeFormat(undefined, {
      timeStyle: 'short',
    }).format(new Date('2026-07-24T09:01:00.000Z'));

    expect(
      formatRunTimestamp('2026-07-24T09:01:00.000Z', undefined, fakeT),
    ).toBe(
      `${ScheduledTasksI18nKeys.DetailHistoryTodayAt}:${JSON.stringify({ time })}`,
    );
  });

  it('passes the short date and time to the date key', () => {
    const start = new Date('2026-07-17T09:01:00.000Z');
    const date = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(start);
    const time = new Intl.DateTimeFormat(undefined, {
      timeStyle: 'short',
    }).format(start);

    expect(
      formatRunTimestamp('2026-07-17T09:01:00.000Z', undefined, fakeT),
    ).toBe(
      `${ScheduledTasksI18nKeys.DetailHistoryDateAt}:${JSON.stringify({ date, time })}`,
    );
  });

  it('appends the translated duration when durationSeconds is present', () => {
    expect(formatRunTimestamp('2026-07-17T09:01:00.000Z', 99, fakeT)).toContain(
      ScheduledTasksI18nKeys.DetailHistoryDurationSuffix,
    );
  });
});

describe('mapScheduledTaskRunDtoToItem', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'UTC');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the item with translated labels and the app id comparison', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({
        durationSeconds: 99,
        conversationId: 'conversations/bucket/.scheduler/sched_123/run_1',
      }),
      fakeT,
      [buildConversation({ isUnread: true })],
    );

    expect(result.status).toBe(ScheduledTaskRunStatus.Success);
    expect(result.durationLabel).toMatch(
      new RegExp(`^${ScheduledTasksI18nKeys.DetailHistoryDurationSuffix}:`),
    );
    expect(result.timestampLabel).not.toContain(
      ScheduledTasksI18nKeys.DetailHistoryDurationSuffix,
    );
    expect(result.isUnread).toBe(true);
  });
});

describe('mapScheduledTaskRunDtosToItems', () => {
  it('maps every dto in the list, preserving order', () => {
    expect(
      mapScheduledTaskRunDtosToItems(
        [buildRunDto({ id: 'run_1' }), buildRunDto({ id: 'run_2' })],
        fakeT,
        [],
      ).map((item) => item.id),
    ).toEqual(['run_1', 'run_2']);
  });
});

describe('findMatchingConversation', () => {
  it('matches ids that differ only by the conversations/ resource prefix', () => {
    const conversations = [
      buildConversation({ id: 'bucket/.scheduler/sched_123/run_1' }),
    ];

    expect(
      findMatchingConversation(
        'conversations/bucket/.scheduler/sched_123/run_1',
        conversations,
      ),
    ).toBe(conversations[0]);
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
