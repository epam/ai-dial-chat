import type { ScheduledTaskDto } from '@epam/ai-dial-chat-api-client';
import {
  resolveActiveScheduledTask,
  useActiveScheduledTaskDetails,
  ActiveScheduledTaskDetailState,
  ActiveScheduledTaskStatus,
} from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useLocation } from 'react-router';
import { isSafePathSegment } from '../constants/routes';
import {
  useScheduledTaskRuns,
  type UseScheduledTaskRunsResult,
} from '../hooks/scheduled-tasks/useScheduledTaskRuns';
import { getScheduledTask } from '../server-api/scheduled-tasks.api';
import { ROUTES } from '../types/routes';
import { conversationIdsMatch } from '../utils/conversation-id-match';
import { useFeatureFlag } from './AppConfigContext';
import { useConversations } from './ConversationsContext';

interface ActiveScheduledTaskContextType {
  /**
   * The traversal-guarded conversation id derived from the current route, or
   * `null` outside `/conversations/*` or on a malformed path. Exposed on the
   * value so consumers re-render only when the id itself changes — not on
   * every location change a `useLocation` subscription would fire on.
   */
  routeConversationId: string | null;
  /**
   * `'resolving'` while the conversation list hasn't loaded once yet and no
   * matching item was found; `'not-a-task-conversation'` once resolved and
   * either no match exists or the match isn't scheduler-created (or the
   * `scheduledTasksEnabled` feature flag is off); `'task-conversation'` once
   * a match with `isScheduledTask`, `scheduleId`, and `runId` is found.
   */
  status: ActiveScheduledTaskStatus;
  /** Present only when `status === 'task-conversation'`. */
  scheduleId?: string;
  /** Present only when `status === 'task-conversation'`. */
  runId?: string;
  /**
   * The matched conversation list item's `updatedAt` (epoch ms), present only when
   * `status === 'task-conversation'`. Used as an immediate timestamp fallback while
   * `runId` hasn't appeared yet in the paginated run history (e.g. the run that just
   * created this conversation, not yet reflected in `history.items`).
   */
  conversationUpdatedAt?: number;
  /**
   * The matched conversation list item's `title`, present only when
   * `status === 'task-conversation'`. Used as the sources-panel header
   * fallback while the task's own `displayName` hasn't loaded (or failed).
   */
  conversationTitle?: string;
  /** Fetch status of `getScheduledTask(scheduleId)`. `'idle'` outside a task conversation. */
  taskState: ActiveScheduledTaskDetailState;
  /** Resolved task details once `taskState === 'success'`. */
  task: ScheduledTaskDto | null;
  /** Non-404 fetch failure, present only when `taskState === 'error'`. */
  taskError: Error | null;
  /** Re-fetches `getScheduledTask` for the current `scheduleId`. */
  retryTask: () => void;
  /** Paginated run history for the current `scheduleId`, shared by all consumers. */
  history: UseScheduledTaskRunsResult;
}

const loadTaskDetails = (id: string) => getScheduledTask(id);

const ActiveScheduledTaskContext = createContext<
  ActiveScheduledTaskContextType | undefined
>(undefined);

/**
 * Derives the raw conversation id segment from the current route, or `null`
 * outside `/conversations/*` or when a segment is empty/`.`/`..` — the same
 * traversal guard `getConversationRoute` applies, so a malformed path never
 * reaches `conversationIdsMatch`.
 */
const useRouteConversationId = (): string | null => {
  const { pathname } = useLocation();

  return useMemo(() => {
    const prefix = `${ROUTES.Conversations}/`;
    if (!pathname.startsWith(prefix)) return null;
    const id = pathname.slice(prefix.length);
    if (!id) return null;
    if (id.split('/').some((segment) => !isSafePathSegment(segment))) {
      return null;
    }
    return id;
  }, [pathname]);
};

/**
 * Resolves the active conversation's scheduler metadata (from the already-loaded
 * conversation list, matched by {@link conversationIdsMatch}) and owns the
 * concurrent, cancellable fetch of the task's details and run history, so the
 * conversation banner and the sources panel share one set of requests.
 */
export const ActiveScheduledTaskProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const routeConversationId = useRouteConversationId();
  const { conversations, isLoading: isConversationsLoading } =
    useConversations();
  const isFeatureEnabled = useFeatureFlag('scheduledTasksEnabled');

  const {
    status,
    scheduleId,
    runId,
    conversationUpdatedAt,
    conversationTitle,
  } = useMemo(
    () =>
      resolveActiveScheduledTask({
        routeConversationId,
        enabled: isFeatureEnabled,
        isLoading: isConversationsLoading,
        items: conversations,
        matches: conversationIdsMatch,
      }),
    [
      routeConversationId,
      isFeatureEnabled,
      isConversationsLoading,
      conversations,
    ],
  );
  const { taskState, task, taskError, retryTask } =
    useActiveScheduledTaskDetails(scheduleId, loadTaskDetails);

  const history = useScheduledTaskRuns(
    scheduleId ?? '',
    Boolean(scheduleId),
    task?.nextRunTime,
  );

  const value = useMemo(
    () => ({
      routeConversationId,
      status,
      scheduleId,
      runId,
      conversationUpdatedAt,
      conversationTitle,
      taskState,
      task,
      taskError,
      retryTask,
      history,
    }),
    [
      routeConversationId,
      status,
      scheduleId,
      runId,
      conversationUpdatedAt,
      conversationTitle,
      taskState,
      task,
      taskError,
      retryTask,
      history,
    ],
  );

  return (
    <ActiveScheduledTaskContext.Provider value={value}>
      {children}
    </ActiveScheduledTaskContext.Provider>
  );
};

/** Reads the active conversation's scheduler resolution/fetch state. Throws outside `ActiveScheduledTaskProvider`. */
export const useActiveScheduledTask = (): ActiveScheduledTaskContextType => {
  const context = useContext(ActiveScheduledTaskContext);
  if (!context) {
    throw new Error(
      'useActiveScheduledTask must be used within an ActiveScheduledTaskProvider',
    );
  }
  return context;
};
