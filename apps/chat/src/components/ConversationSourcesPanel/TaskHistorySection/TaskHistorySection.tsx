import {
  ScheduledTaskRunHistoryList,
  type ScheduledTaskRunItem,
} from '@epam/ai-dial-scheduled-tasks';
import { Accordion, ButtonVariant, GhostButton } from '@epam/ai-dial-ui-kit';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from 'react';
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
 * History accordion of a task conversation's sources panel: the schedule's
 * paginated runs with the current run highlighted and a Show-more footer.
 * Owns the run mapping, labels, and the expanded-state reset on schedule
 * change.
 */
const TaskHistorySection: FC<Props> = ({
  history,
  currentRunId,
  scheduleId,
}) => {
  const { t } = useTranslation();
  const { conversations } = useConversations();
  const navigate = useNavigate();

  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    setIsExpanded(true);
  }, [scheduleId]);

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
      historyTitle: t(ScheduledTasksI18nKeys.DetailHistoryTitle),
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

  const footer =
    history.hasMore && !history.isLoading ? (
      <li className="pt-2">
        <GhostButton
          variant={ButtonVariant.Primary}
          label={t(ButtonsI18nKeys.ShowMore)}
          onClick={history.loadMore}
          disabled={history.isLoadingMore}
        />
      </li>
    ) : undefined;

  return (
    <Accordion
      title={
        /*
         * `block` breaks the title out of the kit title span's `dial-body-text`
         * strut (line-height 24) — an inline child can never shrink a line box
         * below the parent's strut, so the 12/16 title needs its own block.
         * `py-1` grows that block to the design's 24px title height, keeping
         * the 16px text line vertically centered.
         */
        <span className="dial-tiny-semi-text block truncate py-1">
          {t(ScheduledTasksI18nKeys.DetailHistoryTitle)}
        </span>
      }
      expanded={isExpanded}
      onToggle={setIsExpanded}
      /* The kit's content region pads px-4 (16px); the design narrows the History rows' start inset to 12px. */
      contentClassName="ps-3"
    >
      <ScheduledTaskRunHistoryList
        items={runItems}
        isLoading={history.isLoading}
        isLoadingMore={history.isLoadingMore}
        error={history.error}
        onRetry={history.refetch}
        currentRunId={currentRunId}
        onRunClick={handleRunClick}
        labels={labels}
        footer={footer}
      />
    </Accordion>
  );
};

export default memo(TaskHistorySection);
