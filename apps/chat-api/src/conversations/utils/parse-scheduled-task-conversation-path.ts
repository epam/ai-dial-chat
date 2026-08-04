import { safeDecodeURIComponent } from '../../common/utils/uri';

const SCHEDULER_SEGMENT = '.scheduler';
const SCHEDULER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface ScheduledTaskConversationPath {
  scheduleId: string;
  runId: string;
}

/**
 * Detects the reserved `conversations/{bucket}/.scheduler/{scheduleId}/{runId}/...`
 * path shape DIAL Scheduler writes conversations under, and extracts the ids.
 * Pure and side-effect free so it can be unit tested and reused without
 * constructing ConversationService.
 */
export const parseScheduledTaskConversationPath = (
  resourceId: string,
): ScheduledTaskConversationPath | null => {
  // Expected shape: conversations/{bucket}/.scheduler/{scheduleId}/{runId}/...
  const segments = resourceId.split('/');
  const SCHEDULER_SEGMENT_INDEX = 2;
  if (segments[SCHEDULER_SEGMENT_INDEX] !== SCHEDULER_SEGMENT) return null;

  const [rawScheduleId, rawRunId] = segments.slice(
    SCHEDULER_SEGMENT_INDEX + 1,
    SCHEDULER_SEGMENT_INDEX + 3,
  );
  if (!rawScheduleId || !rawRunId) return null;

  const scheduleId = safeDecodeURIComponent(rawScheduleId);
  const runId = safeDecodeURIComponent(rawRunId);
  if (
    !SCHEDULER_ID_PATTERN.test(scheduleId) ||
    !SCHEDULER_ID_PATTERN.test(runId)
  ) {
    return null;
  }

  return { scheduleId, runId };
};
