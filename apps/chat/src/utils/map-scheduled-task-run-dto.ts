import type {
  ConversationListItemDto,
  ScheduledTaskRunDto,
} from '@epam/ai-dial-chat-api-client';
import {
  formatScheduledTaskRunDuration,
  formatScheduledTaskRunTimestamp,
  toScheduledTaskRunItem,
  type ScheduledTaskRunDurationLabels,
  type ScheduledTaskRunItemOptions,
  type ScheduledTaskRunTimestampLabels,
} from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import type { ScheduledTaskRunItem } from '@epam/ai-dial-scheduled-tasks';
import type { TFunction } from 'i18next';
import { ScheduledTasksI18nKeys } from '../constants/translation-keys';
import { conversationIdsMatch } from './conversation-id-match';

const buildRunDurationLabels = (
  t: TFunction,
): ScheduledTaskRunDurationLabels => ({
  hours: (count) =>
    t(ScheduledTasksI18nKeys.DetailHistoryDurationHours, { count }),
  minutes: (count) =>
    t(ScheduledTasksI18nKeys.DetailHistoryDurationMinutes, { count }),
  seconds: (count) =>
    t(ScheduledTasksI18nKeys.DetailHistoryDurationSeconds, { count }),
  suffix: (duration) =>
    t(ScheduledTasksI18nKeys.DetailHistoryDurationSuffix, { duration }),
});

const buildRunTimestampLabels = (
  t: TFunction,
): ScheduledTaskRunTimestampLabels => ({
  todayAt: (time) => t(ScheduledTasksI18nKeys.DetailHistoryTodayAt, { time }),
  dateAt: (date, time) =>
    t(ScheduledTasksI18nKeys.DetailHistoryDateAt, { date, time }),
});

const buildRunItemOptions = (
  t: TFunction,
  conversations: ConversationListItemDto[],
): ScheduledTaskRunItemOptions => ({
  timestampLabels: buildRunTimestampLabels(t),
  durationLabels: buildRunDurationLabels(t),
  conversations,
  conversationIdsMatch,
});

/** Formats a run's duration as `(45s)`, `(1m 1s)` or `(1h 2m 3s)`, or returns `undefined` when it is absent. */
export const formatRunDuration = (
  durationSeconds: number | undefined,
  t: TFunction,
): string | undefined =>
  formatScheduledTaskRunDuration(durationSeconds, buildRunDurationLabels(t));

/** Formats a run's `startTime` as "today at 9:01 AM" or "Jul 17 at 9:01 AM", then appends a `(1m 1s)` duration suffix when `durationSeconds` is present. */
export const formatRunTimestamp = (
  startTime: string,
  durationSeconds: number | undefined,
  t: TFunction,
): string =>
  formatScheduledTaskRunTimestamp(
    startTime,
    durationSeconds,
    buildRunTimestampLabels(t),
    { durationLabels: buildRunDurationLabels(t) },
  );

/** Finds the loaded conversation-list item matching a run's `conversationId`, tolerating id-format differences via `conversationIdsMatch`. */
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
): ScheduledTaskRunItem =>
  toScheduledTaskRunItem(run, buildRunItemOptions(t, conversations));

/** Maps a list of `ScheduledTaskRunDto` to lib-facing run items, preserving order. */
export const mapScheduledTaskRunDtosToItems = (
  runs: ScheduledTaskRunDto[],
  t: TFunction,
  conversations: ConversationListItemDto[],
): ScheduledTaskRunItem[] => {
  const options = buildRunItemOptions(t, conversations);
  return runs.map((run) => toScheduledTaskRunItem(run, options));
};
