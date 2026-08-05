import { safeDecodeURIComponent } from '../../common/utils/uri';
import { getRunIdFromFilename } from './conversation.utils';

const SCHEDULER_SEGMENT = '.scheduler';
const SCHEDULE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Path shape: conversations/{bucket}/.scheduler/{scheduleId}/{deploymentId}__{title}__{runId}
const BUCKET_SEGMENT_INDEX = 1;
const SCHEDULER_SEGMENT_INDEX = BUCKET_SEGMENT_INDEX + 1;
const SCHEDULE_ID_SEGMENT_INDEX = SCHEDULER_SEGMENT_INDEX + 1;
const FILENAME_SEGMENT_INDEX = SCHEDULE_ID_SEGMENT_INDEX + 1;

export interface ScheduledTaskConversationPath {
  scheduleId: string;
  runId: string;
}

/**
 * Detects the reserved `conversations/{bucket}/.scheduler/{scheduleId}/{filename}`
 * path shape DIAL Scheduler writes conversations under, and extracts the
 * schedule id (from the path) and the run id (the trailing UUID segment of
 * the conversation filename itself, `{deploymentId}__{title}__{runId}`).
 * Pure and side-effect free so it can be unit tested and reused without
 * constructing ConversationService.
 */
export const parseScheduledTaskConversationPath = (
  resourceId: string,
): ScheduledTaskConversationPath | null => {
  const segments = resourceId.split('/');
  if (segments[SCHEDULER_SEGMENT_INDEX] !== SCHEDULER_SEGMENT) return null;
  if (segments.length !== FILENAME_SEGMENT_INDEX + 1) return null;

  const rawScheduleId = segments[SCHEDULE_ID_SEGMENT_INDEX];
  const rawFilename = segments[FILENAME_SEGMENT_INDEX];
  if (!rawScheduleId || !rawFilename) return null;

  const scheduleId = safeDecodeURIComponent(rawScheduleId);
  if (!SCHEDULE_ID_PATTERN.test(scheduleId)) return null;

  const filename = safeDecodeURIComponent(rawFilename);
  const runId = getRunIdFromFilename(filename);
  if (!runId) return null;

  return { scheduleId, runId };
};
