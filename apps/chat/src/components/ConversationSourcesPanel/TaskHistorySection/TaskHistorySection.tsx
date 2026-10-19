import {
  ScheduledTaskConversationHistorySection,
  type ScheduledTaskRunItem,
} from '@epam/ai-dial-scheduled-tasks';
import { memo, useCallback, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { getConversationRoute } from '../../../constants/routes';
import {
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../../constants/translation-keys';
import { useConversations } from '../../../context/ConversationsContext';
import type { UseScheduledTaskRunsResult } from '../../../hooks/scheduled-tasks/useScheduledTaskRuns';
import { mapScheduledTaskRunDtosToItems } from '../../../utils/map-scheduled-task-run-dto';

interface Props {
  /** Paginated run history of the active schedule, shared by all task-panel consumers. */
  history: UseScheduledTaskRunsResult;
  /** The run that produced this conversation, highlighted as current. */
  currentRunId?: string;
  /** Active schedule id — the expanded state resets whenever it changes. */
  scheduleId?: string;
}

/*
 * App adapter for the lib's History accordion: owns the run-DTO mapping, the
 * localized labels, and the navigation handler, and hands the resolved data
 * to the host-agnostic `ScheduledTaskConversationHistorySection`.
 */
const TaskHistorySection: FC<Props> = ({
  history,
  currentRunId,
  scheduleId,
}) => {
  const { t } = useTranslation();
  const { conversations } = useConversations();
  const navigate = useNavigate();

  const runItems = useMemo(
    () => mapScheduledTaskRunDtosToItems(history.items, t, conversations),
    [history.items, t, conversations],
  );

  const handleRunClick = useCallback(
    (run: ScheduledTaskRunItem) => {
      if (!run.conversationId) return;
      navigate(getConversationRoute(run.conversationId));
    },
    [navigate],
  );

  const labels = useMemo(
    () => ({
      title: t(ScheduledTasksI18nKeys.DetailHistoryTitle),
      showMoreLabel: t(ButtonsI18nKeys.ShowMore),
      emptyLabel: t(ScheduledTasksI18nKeys.DetailHistoryEmptyLabel),
      errorLabel: t(ScheduledTasksI18nKeys.DetailHistoryErrorLabel),
      retryLabel: t(ScheduledTasksI18nKeys.ListRetryLabel),
      runStatusLabels: {
        success: t(ScheduledTasksI18nKeys.DetailStatusSuccess),
        error: t(ScheduledTasksI18nKeys.DetailStatusError),
        inProgress: t(ScheduledTasksI18nKeys.DetailStatusInProgress),
        missed: t(ScheduledTasksI18nKeys.DetailStatusMissed),
      },
      currentRunLabel: t(
        ScheduledTasksI18nKeys.ConversationPanelCurrentRunLabel,
      ),
      unreadIndicatorLabel: t(ConversationPanelI18nKeys.UnreadIndicatorLabel),
    }),
    [t],
  );

  return (
    <ScheduledTaskConversationHistorySection
      scheduleId={scheduleId}
      items={runItems}
      isLoading={history.isLoading}
      isLoadingMore={history.isLoadingMore}
      error={history.error}
      onRetry={history.refetch}
      hasMore={history.hasMore}
      onLoadMore={history.loadMore}
      currentRunId={currentRunId}
      onRunClick={handleRunClick}
      labels={labels}
    />
  );
};

export default memo(TaskHistorySection);
