import { useScheduledTaskRuns as useSharedScheduledTaskRuns } from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import { useMemo } from 'react';
import { useConversations } from '../../context/ConversationsContext';
import { schedulerClient } from '../../server-api/scheduled-tasks.api';

/** App adapter retaining run-history presentation ownership and feature gating. */
export const useScheduledTaskRuns = (
  scheduleId: string,
  enabled = true,
  nextRunTime?: string | null,
) => {
  const { refreshConversations } = useConversations();
  const client = useMemo<typeof schedulerClient>(
    () => ({
      ...schedulerClient,
      listScheduledTaskRuns: async (params) => {
        const page = await schedulerClient.listScheduledTaskRuns(params);
        /* The shared hook preserves its items reference on unchanged polls.
         Observe successful responses so a later-created chat is still found. */
        if (
          !params.signal?.aborted &&
          page.items.some((run) => run.conversationId)
        ) {
          void refreshConversations(
            page.items.flatMap((run) =>
              run.conversationId ? [run.conversationId] : [],
            ),
          );
        }
        return page;
      },
    }),
    [refreshConversations],
  );
  const result = useSharedScheduledTaskRuns(client, {
    scheduleId,
    enabled,
    nextRunTime,
  });
  return { ...result, error: result.initialError };
};

/** Public app-adapter result retained for active-task conversation consumers. */
export type UseScheduledTaskRunsResult = ReturnType<
  typeof useScheduledTaskRuns
>;
