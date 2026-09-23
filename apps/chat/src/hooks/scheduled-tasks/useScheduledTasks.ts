import { useScheduledTasks as useSharedScheduledTasks } from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import { ScheduledTasksSortKey } from '@epam/ai-dial-scheduled-tasks';
import { schedulerClient } from '../../server-api/scheduled-tasks.api';

/** App adapter retaining dashboard ownership while delegating request lifetime. */
export const useScheduledTasks = (enabled = true) => {
  const result = useSharedScheduledTasks(schedulerClient, {
    enabled,
    initialSort: ScheduledTasksSortKey.FirstToRun,
  });

  return {
    ...result,
    sortKey: result.sortKey as ScheduledTasksSortKey,
    setSortKey: result.setSortKey as (key: ScheduledTasksSortKey) => void,
    error: result.initialError,
    loadMoreError: result.loadMoreError,
    retryLoadMore: result.retryLoadMore,
  };
};
