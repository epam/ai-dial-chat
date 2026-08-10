import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  GhostButton,
  Skeleton,
  SkeletonVariant,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
} from '@tabler/icons-react';
import { type FC, type KeyboardEvent } from 'react';
import type { ScheduledTaskRunHistoryListProps } from '../../models/scheduled-task-run-history-list-props';
import type { ScheduledTaskRunItem } from '../../models/scheduled-task-run-item';
import { ScheduledTaskRunStatus } from '../../types/scheduled-task-run-status';
import styles from './ScheduledTaskRunHistoryList.module.scss';

const RunStatusIcon: FC<{ status: ScheduledTaskRunStatus }> = ({ status }) => {
  switch (status) {
    case ScheduledTaskRunStatus.Success:
      return (
        <IconCircleCheck
          size={DIAL_ICON_SIZE.SM}
          className={styles.successIcon}
          aria-hidden
        />
      );
    case ScheduledTaskRunStatus.Error:
      return (
        <IconCircleX
          size={DIAL_ICON_SIZE.SM}
          className={styles.errorIcon}
          aria-hidden
        />
      );
    case ScheduledTaskRunStatus.InProgress:
      return (
        <span aria-hidden>
          <Spinner size={DIAL_ICON_SIZE.SM} />
        </span>
      );
    case ScheduledTaskRunStatus.Missed:
      return (
        <IconAlertTriangle
          size={DIAL_ICON_SIZE.SM}
          className={styles.missedIcon}
          aria-hidden
        />
      );
    default:
      return null;
  }
};

/**
 * Presentational, paginated-agnostic list of scheduled-task run rows: status
 * icon, timestamp, optional current-run highlight, skeleton/empty/error
 * states. Holds no fetching or pagination-trigger logic — callers supply a
 * `footer` slot for whichever "load more" affordance they need.
 */
export const ScheduledTaskRunHistoryList: FC<
  ScheduledTaskRunHistoryListProps
> = ({
  items,
  isLoading = false,
  isLoadingMore = false,
  skeletonCount = 6,
  error,
  onRetry,
  currentRunId,
  onRunClick,
  labels,
  footer,
  styles: listStyles,
}) => {
  const { colors, typography } = listStyles ?? {};
  const runTimestampClassName =
    typography?.runTimestampClassName ?? 'dial-small-text';

  const cssVars = buildCssVars({
    '--strhl-success-icon': colors?.successIconColor,
    '--strhl-error-icon': colors?.errorIconColor,
    '--strhl-missed-icon': colors?.missedIconColor,
    '--strhl-subtitle-text': colors?.subtitleTextColor,
    '--strhl-current-run-bg': colors?.currentRunBackground,
  });

  const renderRow = (run: ScheduledTaskRunItem) => {
    const statusLabel = labels.runStatusLabels[run.status];
    const isCurrent = run.id === currentRunId;
    const accessibleName =
      isCurrent && labels.currentRunLabel
        ? `${statusLabel} ${run.timestampLabel} — ${labels.currentRunLabel}`
        : `${statusLabel} ${run.timestampLabel}`;
    const isClickable = Boolean(onRunClick);

    return (
      <li
        key={run.id}
        {...(isClickable
          ? {
              role: 'button',
              tabIndex: 0,
              onClick: () => onRunClick?.(run.id),
              onKeyDown: (event: KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRunClick?.(run.id);
                }
              },
            }
          : {})}
        aria-label={accessibleName}
        aria-current={isCurrent ? 'true' : undefined}
        className={mergeClasses(
          'flex h-8 items-center justify-between gap-2 rounded-full pe-2 ps-5',
          isCurrent && styles.currentRun,
          isClickable && 'cursor-pointer',
        )}
      >
        <span className={mergeClasses(runTimestampClassName, 'truncate')}>
          {run.timestampLabel}
        </span>
        <span className="flex h-8 w-14 shrink-0 items-center justify-end">
          <RunStatusIcon status={run.status} />
        </span>
      </li>
    );
  };

  const renderSkeletons = (count: number) =>
    Array.from({ length: count }, (_, index) => (
      <li
        key={`history-skeleton-${index}`}
        aria-hidden="true"
        className="flex h-8 items-center justify-between gap-2 pe-2 ps-5"
      >
        <Skeleton
          variant={SkeletonVariant.Rectangular}
          width="160px"
          height="16px"
        />
        <Skeleton
          variant={SkeletonVariant.Rectangular}
          width="16px"
          height="16px"
          className="shrink-0 rounded-full"
        />
      </li>
    ));

  if (isLoading && items.length === 0) {
    return (
      <ul style={cssVars} aria-label={labels.historyTitle}>
        {renderSkeletons(skeletonCount)}
      </ul>
    );
  }

  if (error) {
    return (
      <div style={cssVars} className="flex flex-col items-start gap-3">
        <p
          role="alert"
          className={mergeClasses('dial-body-text', styles.subtitleText)}
        >
          {labels.errorLabel}
        </p>
        <GhostButton label={labels.retryLabel} onClick={onRetry} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p
        role="status"
        style={cssVars}
        className={mergeClasses('dial-body-text', styles.subtitleText)}
      >
        {labels.emptyLabel}
      </p>
    );
  }

  return (
    <ul style={cssVars} aria-label={labels.historyTitle}>
      {items.map(renderRow)}
      {isLoadingMore && renderSkeletons(skeletonCount)}
      {footer}
    </ul>
  );
};
