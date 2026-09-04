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

/**
 * Formats a run's `startTime` as "today at 9:01 AM" when it falls on the
 * current calendar day, or "Jul 17 at 9:01 AM" otherwise, then appends a
 * `(99s)` duration suffix when `durationSeconds` is present.
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

  if (durationSeconds == null) return dateLabel;

  return `${dateLabel} ${t(ScheduledTasksI18nKeys.DetailHistoryDurationSuffix, { seconds: durationSeconds })}`;
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
});

/** Maps a list of `ScheduledTaskRunDto` to lib-facing run items, preserving order. */
export const mapScheduledTaskRunDtosToItems = (
  runs: ScheduledTaskRunDto[],
  t: TFunction,
  conversations: ConversationListItemDto[],
): ScheduledTaskRunItem[] =>
  runs.map((run) => mapScheduledTaskRunDtoToItem(run, t, conversations));
