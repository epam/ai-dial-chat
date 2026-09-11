import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { GhostButton } from '@epam/ai-dial-ui-kit';
import { type FC } from 'react';
import type { ScheduledTaskHistorySectionProps } from '../../models/scheduled-task-history-section-props';
import { ScheduledTaskHistorySectionVariant } from '../../types/scheduled-task-history-section-variant';
import { ScheduledTaskRunHistoryList } from '../ScheduledTaskRunHistoryList/ScheduledTaskRunHistoryList';
import styles from './ScheduledTaskHistorySection.module.scss';

/* Reads the `--stdv-*` vars the parent ScheduledTaskDetailView sets on its
 * root, so the card background and text color stay overridable through the
 * view's `styles.colors` without this section taking matching color props
 * (the status-icon/dot colors it does take are forwarded to the run list). */
/** History run list with its "Show more" footer, rendered as the desktop self-scrolling card or as standard mobile/tablet page flow. */
export const ScheduledTaskHistorySection: FC<
  ScheduledTaskHistorySectionProps
> = ({
  variant,
  labels,
  nextRunLabel,
  items,
  isLoading = false,
  isLoadingMore = false,
  skeletonCount = 6,
  error,
  onRetry,
  hasMore = false,
  onLoadMore,
  onRunClick,
  runTimestampClassName = 'dial-small-text',
  sectionTitleClassName = 'dial-body-semi-text',
  colors,
}) => {
  const isCard = variant === ScheduledTaskHistorySectionVariant.Card;

  /*
   * The card variant pins the footer to the bottom of its own scroll
   * container with the card background; the flow variant renders it inline
   * after the loaded rows, in normal page flow.
   */
  const footerClassName = isCard
    ? mergeClasses(
        'sticky bottom-0 z-10 rounded-b-xl px-6 pb-5 pt-2',
        styles.historyCard,
      )
    : 'pt-2';
  const footer =
    onLoadMore && hasMore && labels.historyShowMoreLabel ? (
      <li className={footerClassName}>
        <GhostButton
          label={labels.historyShowMoreLabel}
          onClick={onLoadMore}
          disabled={isLoadingMore}
        />
      </li>
    ) : undefined;

  const nextRun = nextRunLabel ? (
    <p className={mergeClasses(runTimestampClassName, styles.subtitleText)}>
      {nextRunLabel}
    </p>
  ) : undefined;

  const loadingMoreAnnouncement = labels.historyLoadingMoreLabel ? (
    <span role="status" aria-live="polite" className="sr-only">
      {isLoadingMore ? labels.historyLoadingMoreLabel : ''}
    </span>
  ) : undefined;

  const runList = (
    <ScheduledTaskRunHistoryList
      items={items}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      skeletonCount={skeletonCount}
      error={error}
      onRetry={onRetry}
      onRunClick={onRunClick}
      labels={{
        historyTitle: labels.historyTitle,
        emptyLabel: labels.historyEmptyLabel,
        errorLabel: labels.historyErrorLabel,
        retryLabel: labels.historyRetryLabel,
        runStatusLabels: labels.runStatusLabels,
        unreadIndicatorLabel: labels.unreadIndicatorLabel,
      }}
      footer={footer}
      styles={{ typography: { runTimestampClassName }, colors }}
    />
  );

  if (isCard) {
    return (
      <div
        className={mergeClasses(
          'flex max-h-[70vh] w-full flex-col overflow-y-auto rounded-xl shadow-md desktop:w-[360px]',
          styles.historyCard,
        )}
      >
        <div
          className={mergeClasses(
            'sticky top-0 z-10 flex flex-col gap-4 rounded-t-xl px-6 pb-2 pt-5',
            styles.historyCard,
          )}
        >
          <h2 className={sectionTitleClassName}>{labels.historyTitle}</h2>
          {nextRun}
          {loadingMoreAnnouncement}
        </div>
        <div className="flex flex-1 flex-col gap-4 px-6 pb-2">{runList}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {nextRun}
      {loadingMoreAnnouncement}
      {runList}
    </div>
  );
};
