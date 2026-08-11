import type { ScheduledTaskRunDto } from '@epam/ai-dial-chat-api-client';
import { ScheduledTaskRunStatus } from '@epam/ai-dial-scheduled-tasks';
import type { TFunction } from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduledTasksI18nKeys } from '../../constants/translation-keys';
import {
  mapScheduledTaskRunDtoToItem,
  mapScheduledTaskRunDtosToItems,
} from '../map-scheduled-task-run-dto';

const fakeT = ((key: string, options?: Record<string, unknown>): string =>
  options ? `${key}:${JSON.stringify(options)}` : key) as TFunction;

const buildRunDto = (
  overrides?: Partial<ScheduledTaskRunDto>,
): ScheduledTaskRunDto => ({
  id: 'run_1',
  status: 'Success',
  startTime: '2026-07-24T09:01:00.000Z',
  ...overrides,
});

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
    );

    expect(result.status).toBe(expected);
  });

  it('falls back to Missed for an unrecognized upstream status', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ status: 'something-unexpected' as never }),
      fakeT,
    );

    expect(result.status).toBe(ScheduledTaskRunStatus.Missed);
  });

  it('preserves the run id', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ id: 'run_42' }),
      fakeT,
    );

    expect(result.id).toBe('run_42');
  });

  it('formats a same-day startTime via the "today" translation key', () => {
    const result = mapScheduledTaskRunDtoToItem(buildRunDto(), fakeT);

    expect(result.timestampLabel).toMatch(
      new RegExp(`^${ScheduledTasksI18nKeys.DetailHistoryTodayAt}:`),
    );
  });

  it('formats a different-day startTime via the "date" translation key', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ startTime: '2026-07-17T09:01:00.000Z' }),
      fakeT,
    );

    expect(result.timestampLabel).toMatch(
      new RegExp(`^${ScheduledTasksI18nKeys.DetailHistoryDateAt}:`),
    );
  });

  it('appends a duration suffix when durationSeconds is present', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ durationSeconds: 99 }),
      fakeT,
    );

    expect(result.timestampLabel).toContain(
      `${ScheduledTasksI18nKeys.DetailHistoryDurationSuffix}:${JSON.stringify({ seconds: 99 })}`,
    );
  });

  it('omits the duration suffix when durationSeconds is absent (e.g. an in-progress run)', () => {
    const result = mapScheduledTaskRunDtoToItem(
      buildRunDto({ status: 'InProgress', durationSeconds: undefined }),
      fakeT,
    );

    expect(result.timestampLabel).not.toContain(
      ScheduledTasksI18nKeys.DetailHistoryDurationSuffix,
    );
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
    );

    expect(result.map((item) => item.id)).toEqual(['run_1', 'run_2']);
  });

  it('maps an empty list to an empty array', () => {
    expect(mapScheduledTaskRunDtosToItems([], fakeT)).toEqual([]);
  });
});
