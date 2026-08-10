import { GhostButton, Skeleton, SkeletonVariant } from '@epam/ai-dial-ui-kit';
import { IconChevronRight } from '@tabler/icons-react';
import { FC, memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { getScheduledTaskDetailRoute } from '../../constants/routes';
import { ScheduledTasksI18nKeys } from '../../constants/translation-keys';
import { useActiveScheduledTask } from '../../context/ActiveScheduledTaskContext';
import {
  ActiveScheduledTaskDetailState,
  ActiveScheduledTaskStatus,
} from '../../types/active-scheduled-task';
import {
  formatRunTimestamp,
  mapScheduledTaskRunDtoToItem,
} from '../../utils/map-scheduled-task-run-dto';

const CARD_CLASS_NAME =
  'flex items-center justify-between gap-2 rounded-xl border border-secondary bg-layer-sunken py-3 ps-6 pe-2';

/**
 * Compact summary rendered above a scheduled-task conversation's messages,
 * showing the source task's name, the current run's timestamp, and a link
 * to the task's detail page. Not persisted as a message.
 */
const ScheduledTaskConversationBanner: FC = () => {
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
      return mapScheduledTaskRunDtoToItem(currentRun, t).timestampLabel;
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

  if (status !== ActiveScheduledTaskStatus.TaskConversation || !scheduleId)
    return null;

  if (
    taskState === ActiveScheduledTaskDetailState.Loading ||
    taskState === ActiveScheduledTaskDetailState.Idle
  ) {
    return (
      <div className={CARD_CLASS_NAME}>
        <div
          role="status"
          aria-label={t(ScheduledTasksI18nKeys.ConversationBannerLoadingLabel)}
          className="flex h-5 items-center"
        >
          <Skeleton
            variant={SkeletonVariant.Rectangular}
            width="220px"
            height="16px"
          />
        </div>
      </div>
    );
  }

  if (
    taskState === ActiveScheduledTaskDetailState.Error ||
    taskState === ActiveScheduledTaskDetailState.Unavailable
  ) {
    return (
      <div className={CARD_CLASS_NAME}>
        <p role="alert" className="dial-small-text text-primary">
          {t(ScheduledTasksI18nKeys.ConversationBannerUnavailableLabel)}
        </p>
        {taskState === ActiveScheduledTaskDetailState.Error && (
          <GhostButton
            label={t(ScheduledTasksI18nKeys.ListRetryLabel)}
            aria-label={t(
              ScheduledTasksI18nKeys.ConversationBannerRetryAriaLabel,
            )}
            onClick={retryTask}
          />
        )}
      </div>
    );
  }

  const displayName = task?.displayName ?? '';

  return (
    <div className={CARD_CLASS_NAME}>
      <p className="dial-small-semi-text min-w-0 flex-1 break-words text-primary">
        {displayName}
        {timestampLabel && (
          <span className="dial-small-text"> {timestampLabel}</span>
        )}
      </p>
      <Link
        to={getScheduledTaskDetailRoute(scheduleId)}
        aria-label={t(
          ScheduledTasksI18nKeys.ConversationBannerTaskDetailsAriaLabel,
          { taskName: displayName },
        )}
        className="dial-tiny-semi-text flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-accent hover:bg-control-accent-alpha-hover focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-focus-black"
      >
        {t(ScheduledTasksI18nKeys.ConversationBannerTaskDetailsLabel)}
        <IconChevronRight size={16} className="rtl:scale-x-[-1]" aria-hidden />
      </Link>
    </div>
  );
};

export default memo(ScheduledTaskConversationBanner);
