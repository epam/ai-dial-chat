import { useScheduledTaskRuns as useSharedScheduledTaskRuns } from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import { schedulerClient } from '../../server-api/scheduled-tasks.api';

/** App adapter retaining run-history presentation ownership and feature gating. */
export const useScheduledTaskRuns = (scheduleId: string, enabled = true) => {
  const result = useSharedScheduledTaskRuns(schedulerClient, {
    scheduleId,
    enabled,
  });
  return { ...result, error: result.initialError };
};

/** Public app-adapter result retained for active-task conversation consumers. */
export type UseScheduledTaskRunsResult = ReturnType<
  typeof useScheduledTaskRuns
>;
