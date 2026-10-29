import {
  DIAL_KIT_ICON_STROKE,
  GhostButton,
  Skeleton,
  SkeletonVariant,
} from '@epam/ai-dial-ui-kit';
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
import { formatRunTimestamp } from '../../utils/map-scheduled-task-run-dto';

const CARD_CLASS_NAME =
  'flex items-center justify-between gap-2 rounded-xl border border-secondary bg-layer-sunken py-3 ps-4 pe-2 desktop:ps-6';

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

  if (status !== ActiveScheduledTaskStatus.TaskConversation || !scheduleId)
    return null;

  if (
    taskState === ActiveScheduledTaskDetailState.Loading ||
    taskState === ActiveScheduledTaskDetailState.Idle
  ) {
    return (
      /* A transient placeholder, not a live region: it mounts already
       * loading, so it marks itself busy and names itself in text instead. */
      <div aria-busy="true" className={CARD_CLASS_NAME}>
        <div className="flex h-5 items-center">
          <span className="sr-only">
            {t(ScheduledTasksI18nKeys.ConversationBannerLoadingLabel)}
          </span>
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
      <p className="dial-small-semi-text min-w-0 flex-1 wrap-break-word text-primary">
        {displayName}
        {timestampLabel && (
          /* Own line on mobile so the run time stays readable beside the
           * Task details link; inline after the name on desktop. */
          <span className="dial-small-text block desktop:inline">
            {' '}
            {timestampLabel}
          </span>
        )}
      </p>
      <Link
        to={getScheduledTaskDetailRoute(scheduleId)}
        aria-label={t(
          ScheduledTasksI18nKeys.ConversationBannerTaskDetailsAriaLabel,
          { taskName: displayName },
        )}
        className="dial-tiny-semi-text flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-accent hover:bg-control-accent-alpha-hover focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-focus"
      >
        {t(ScheduledTasksI18nKeys.ConversationBannerTaskDetailsLabel)}
        <IconChevronRight
          size={16}
          className="rtl:scale-x-[-1]"
          aria-hidden
          stroke={DIAL_KIT_ICON_STROKE}
        />
      </Link>
    </div>
  );
};

export default memo(ScheduledTaskConversationBanner);
