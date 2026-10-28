import type {
  ConversationListItemDto,
  ScheduledTaskRunDto,
} from '@epam/ai-dial-chat-api-client';
import {
  ScheduledTaskRunStatus,
  type ScheduledTaskRunItem,
} from '@epam/ai-dial-scheduled-tasks';
import type { TFunction } from 'i18next';
import { ScheduledTasksI18nKeys } from '../constants/translation-keys';
import { conversationIdsMatch } from './conversation-id-match';

const UPSTREAM_STATUS_MAP: Record<string, ScheduledTaskRunStatus> = {
  Success: ScheduledTaskRunStatus.Success,
  Error: ScheduledTaskRunStatus.Error,
  InProgress: ScheduledTaskRunStatus.InProgress,
  Missed: ScheduledTaskRunStatus.Missed,
};

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/**
 * Formats a run's duration as `(45s)`, `(1m 1s)` or `(1h 2m 3s)`, omitting
 * zero-valued units (`(1m)`, `(1h 5s)`) except for a zero duration (`(0s)`).
 * Returns `undefined` when `durationSeconds` is absent.
 */
export const formatRunDuration = (
  durationSeconds: number | undefined,
  t: TFunction,
): string | undefined => {
  if (durationSeconds == null) return undefined;

  const hours = Math.floor(durationSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor(
    (durationSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,
  );
  const seconds = durationSeconds % SECONDS_PER_MINUTE;

  const units: [number, ScheduledTasksI18nKeys][] = [
    [hours, ScheduledTasksI18nKeys.DetailHistoryDurationHours],
    [minutes, ScheduledTasksI18nKeys.DetailHistoryDurationMinutes],
    [seconds, ScheduledTasksI18nKeys.DetailHistoryDurationSeconds],
  ];
  const parts = units
    .filter(([count]) => count > 0)
    .map(([count, key]) => t(key, { count }));

  const duration = parts.length
    ? parts.join(' ')
    : t(ScheduledTasksI18nKeys.DetailHistoryDurationSeconds, { count: 0 });

  return t(ScheduledTasksI18nKeys.DetailHistoryDurationSuffix, { duration });
};

/**
 * Formats a run's `startTime` as "today at 9:01 AM" when it falls on the
 * current calendar day, or "Jul 17 at 9:01 AM" otherwise, then appends a
 * `(1m 1s)` duration suffix when `durationSeconds` is present.
 */
export const formatRunTimestamp = (
  startTime: string,
  durationSeconds: number | undefined,
  t: TFunction,
): string => {
  const start = new Date(startTime);
  const timeLabel = new Intl.DateTimeFormat(undefined, {
    timeStyle: 'short',
  }).format(start);

  const dateLabel = isSameDay(start, new Date())
    ? t(ScheduledTasksI18nKeys.DetailHistoryTodayAt, { time: timeLabel })
    : t(ScheduledTasksI18nKeys.DetailHistoryDateAt, {
        date: new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
        }).format(start),
        time: timeLabel,
      });

  const durationLabel = formatRunDuration(durationSeconds, t);
  return durationLabel ? `${dateLabel} ${durationLabel}` : dateLabel;
};

/**
 * Finds the loaded conversation-list item matching a run's `conversationId`,
 * tolerating id-format differences (e.g. a `conversations/` resource-path
 * prefix) via `conversationIdsMatch`. Returns `undefined` when the run has no
 * conversation id or no match is loaded yet.
 */
export const findMatchingConversation = (
  conversationId: string | undefined,
  conversations: ConversationListItemDto[],
): ConversationListItemDto | undefined =>
  conversationId
    ? conversations.find((c) => conversationIdsMatch(c.id, conversationId))
    : undefined;

/** Maps a `GET /api/v1/scheduled-tasks/:scheduleId/runs` DTO item to the lib-facing `ScheduledTaskRunItem`, resolving `isUnread` from the already-loaded conversation list. */
export const mapScheduledTaskRunDtoToItem = (
  run: ScheduledTaskRunDto,
  t: TFunction,
  conversations: ConversationListItemDto[],
): ScheduledTaskRunItem => ({
  id: run.id,
  status: UPSTREAM_STATUS_MAP[run.status] ?? ScheduledTaskRunStatus.Missed,
  timestampLabel: formatRunTimestamp(run.startTime, run.durationSeconds, t),
  conversationId: run.conversationId,
  isUnread:
    findMatchingConversation(run.conversationId, conversations)?.isUnread ===
    true,
  errorText: run.errorText,
});

/** Maps a list of `ScheduledTaskRunDto` to lib-facing run items, preserving order. */
export const mapScheduledTaskRunDtosToItems = (
  runs: ScheduledTaskRunDto[],
  t: TFunction,
  conversations: ConversationListItemDto[],
): ScheduledTaskRunItem[] =>
  runs.map((run) => mapScheduledTaskRunDtoToItem(run, t, conversations));
