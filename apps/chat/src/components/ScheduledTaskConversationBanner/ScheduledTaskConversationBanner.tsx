import {
  ActiveScheduledTaskDetailState,
  ActiveScheduledTaskStatus,
} from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import {
  ScheduledTaskConversationBanner,
  type ScheduledTaskConversationBannerLabels,
} from '@epam/ai-dial-scheduled-tasks';
import { memo, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { getScheduledTaskDetailRoute } from '../../constants/routes';
import {
  ScheduledTasksI18nKeys,
  ButtonsI18nKeys,
} from '../../constants/translation-keys';
import { useActiveScheduledTask } from '../../context/ActiveScheduledTaskContext';
import { formatRunTimestamp } from '../../utils/map-scheduled-task-run-dto';

/**
 * Feeds the active scheduled task, the translated copy and the detail route
 * into the scheduled-tasks lib's banner, rendered above the conversation's
 * messages. Not persisted as a message.
 */
const ScheduledTaskConversationBannerContainer: FC = () => {
  const { t } = useTranslation();
  const {
    status,
    scheduleId,
    runId,
    conversationUpdatedAt,
    taskState,
    task,
    retryTask,
    history,
  } = useActiveScheduledTask();

  const timestampLabel = useMemo(() => {
    const currentRun = history.items.find((run) => run.id === runId);
    if (currentRun) {
      return formatRunTimestamp(
        currentRun.startTime,
        currentRun.durationSeconds,
        t,
      );
    }
    /*
     * The run that just created this conversation is often not yet present
     * in the first loaded page of run history — fall back to the matched
     * conversation's own `updatedAt` so a timestamp is shown immediately,
     * then swap to the exact run's formatted timestamp once it loads.
     */
    if (conversationUpdatedAt != null) {
      return formatRunTimestamp(
        new Date(conversationUpdatedAt).toISOString(),
        undefined,
        t,
      );
    }
    return undefined;
  }, [history.items, runId, conversationUpdatedAt, t]);

  const labels = useMemo<ScheduledTaskConversationBannerLabels>(
    () => ({
      loadingLabel: t(ScheduledTasksI18nKeys.ConversationBannerLoadingLabel),
      unavailableLabel: t(
        ScheduledTasksI18nKeys.ConversationBannerUnavailableLabel,
      ),
      retryLabel: t(ButtonsI18nKeys.Retry),
      retryAriaLabel: t(
        ScheduledTasksI18nKeys.ConversationBannerRetryAriaLabel,
      ),
      taskDetailsLabel: t(
        ScheduledTasksI18nKeys.ConversationBannerTaskDetailsLabel,
      ),
      taskDetailsAriaLabel: (taskName) =>
        t(ScheduledTasksI18nKeys.ConversationBannerTaskDetailsAriaLabel, {
          taskName,
        }),
    }),
    [t],
  );

  if (status !== ActiveScheduledTaskStatus.TaskConversation || !scheduleId)
    return null;

  return (
    <ScheduledTaskConversationBanner
      isLoading={
        taskState === ActiveScheduledTaskDetailState.Loading ||
        taskState === ActiveScheduledTaskDetailState.Idle
      }
      isUnavailable={
        taskState === ActiveScheduledTaskDetailState.Error ||
        taskState === ActiveScheduledTaskDetailState.Unavailable
      }
      displayName={task?.displayName ?? ''}
      timestampLabel={timestampLabel}
      renderDetailsLink={({ children, ...linkProps }) => (
        <Link to={getScheduledTaskDetailRoute(scheduleId)} {...linkProps}>
          {children}
        </Link>
      )}
      onRetry={
        taskState === ActiveScheduledTaskDetailState.Error
          ? retryTask
          : undefined
      }
      labels={labels}
    />
  );
};

export default memo(ScheduledTaskConversationBannerContainer);
