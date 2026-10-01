import type { ScheduledTaskRunDto } from '@epam/ai-dial-chat-api-client';
import { conversationIdsMatch } from '../../utils/conversation-id-match';

/** A conversation the sidebar's subject tracking observed: its route conversation id and resolved `scheduleId`. */
export interface ObservedSubject {
  conversationId: string | null;
  scheduleId?: string;
}

/** The last resolved schedule with the run conversation ids its loaded history showed. */
export interface RememberedSchedule {
  scheduleId: string;
  runConversationIds: Set<string>;
}

/** Returns the next observed subject: keeps the last resolved scheduleId while the conversation id is unchanged, so a resolve blip does not erase it. */
export const nextObservedSubject = (
  previousSubject: ObservedSubject | null,
  conversationId: string | null,
  scheduleId: string | undefined,
): ObservedSubject => {
  const isSameConversation =
    previousSubject != null &&
    previousSubject.conversationId === conversationId;
  return {
    conversationId,
    scheduleId:
      scheduleId ??
      (isSameConversation ? previousSubject.scheduleId : undefined),
  };
};

/** Returns the remembered run-id set extended with the run ids the loaded history shows. */
export const mergeRunConversationIds = (
  runConversationIds: ReadonlySet<string>,
  historyItems: ScheduledTaskRunDto[],
): Set<string> => {
  const merged = new Set(runConversationIds);
  historyItems.forEach((run) => {
    if (run.conversationId != null) {
      merged.add(run.conversationId);
    }
  });
  return merged;
};

/** Returns the remembered schedule advanced by the resolved schedule's loaded run ids. */
export const nextRememberedSchedule = (
  rememberedSchedule: RememberedSchedule | null,
  scheduleId: string | undefined,
  historyItems: ScheduledTaskRunDto[],
): RememberedSchedule | null => {
  if (scheduleId == null) return rememberedSchedule;
  if (rememberedSchedule?.scheduleId !== scheduleId) {
    /* A schedule change starts empty: on this render the history items may still be the previous schedule's. */
    return { scheduleId, runConversationIds: new Set<string>() };
  }
  return {
    scheduleId,
    runConversationIds: mergeRunConversationIds(
      rememberedSchedule.runConversationIds,
      historyItems,
    ),
  };
};

/** Finds the conversation's schedule id among the remembered run ids, or `null` when no remembered run matches it. */
export const findConversationScheduleId = (
  rememberedSchedule: RememberedSchedule | null,
  conversationId: string | null,
): string | null => {
  if (rememberedSchedule == null || conversationId == null) return null;
  for (const runConversationId of rememberedSchedule.runConversationIds) {
    if (conversationIdsMatch(runConversationId, conversationId)) {
      return rememberedSchedule.scheduleId;
    }
  }
  return null;
};

/** Resolves the schedule a subject belongs to: its resolved `scheduleId`, or the remembered schedule that owns its conversation. */
export const resolveSubjectScheduleId = (
  subject: ObservedSubject,
  rememberedSchedule: RememberedSchedule | null,
): string | null =>
  subject.scheduleId ??
  findConversationScheduleId(rememberedSchedule, subject.conversationId);

/** Whether a conversation-id switch stays inside one schedule — same task, different run. */
export const isSameTaskSwitch = (
  previousSubject: ObservedSubject,
  currentSubject: ObservedSubject,
  rememberedSchedule: RememberedSchedule | null,
): boolean => {
  const previousScheduleId = resolveSubjectScheduleId(
    previousSubject,
    rememberedSchedule,
  );
  const currentScheduleId = resolveSubjectScheduleId(
    currentSubject,
    rememberedSchedule,
  );
  /* Two unresolved schedules are not the same task. */
  const isSameSchedule =
    currentScheduleId != null && currentScheduleId === previousScheduleId;
  return isSameSchedule;
};
