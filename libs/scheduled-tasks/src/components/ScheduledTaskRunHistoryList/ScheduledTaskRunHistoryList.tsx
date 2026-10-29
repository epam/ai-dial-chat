import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostButton,
  Skeleton,
  SkeletonVariant,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleX,
  IconChevronDown,
  IconChevronUp,
  IconClipboardX,
} from '@tabler/icons-react';
import {
  useId,
  useState,
  type CSSProperties,
  type FC,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type { ScheduledTaskRunHistoryListProps } from '../../models/scheduled-task-run-history-list-props';
import type { ScheduledTaskRunItem } from '../../models/scheduled-task-run-item';
import { ScheduledTaskRunStatus } from '../../types/scheduled-task-run-status';
import styles from './ScheduledTaskRunHistoryList.module.scss';

const ROW_CLASS_NAME =
  'flex w-full min-w-0 min-h-[var(--strhl-row-min-height,32px)] items-center gap-2 rounded-full px-3 py-0 text-start text-inherit';

const RunStatusIcon: FC<{ status: ScheduledTaskRunStatus }> = ({ status }) => {
  switch (status) {
    case ScheduledTaskRunStatus.Success:
      return (
        <IconCheck
          size={DIAL_ICON_SIZE.MD}
          className={styles.successIcon}
          aria-hidden
          stroke={DIAL_KIT_ICON_STROKE}
        />
      );
    case ScheduledTaskRunStatus.Error:
      return (
        <IconCircleX
          size={DIAL_ICON_SIZE.MD}
          className={styles.errorIcon}
          aria-hidden
          stroke={DIAL_KIT_ICON_STROKE}
        />
      );
    case ScheduledTaskRunStatus.InProgress:
      return (
        <span aria-hidden>
          <Spinner size={DIAL_ICON_SIZE.MD} />
        </span>
      );
    case ScheduledTaskRunStatus.Missed:
      return (
        <IconAlertTriangle
          size={DIAL_ICON_SIZE.MD}
          className={styles.missedIcon}
          aria-hidden
          stroke={DIAL_KIT_ICON_STROKE}
        />
      );
    default:
      return null;
  }
};

/* The same content keeps status and trailing indicators aligned in both panels. */
const RunContent: FC<{
  run: ScheduledTaskRunItem;
  timestampClassName: string;
  trailing?: ReactNode;
}> = ({ run, timestampClassName, trailing }) => (
  <>
    <span className="flex w-5 shrink-0 items-center">
      <RunStatusIcon status={run.status} />
    </span>
    <span
      className={mergeClasses(
        timestampClassName,
        'min-w-0 flex-1 truncate leading-6',
        run.isUnread && 'font-semibold',
      )}
    >
      {run.timestampLabel}
    </span>
    <span
      className={mergeClasses(
        'flex size-6 shrink-0 items-center justify-center',
        styles.rowEnd,
      )}
    >
      {trailing ??
        (run.isUnread && (
          <span
            className={mergeClasses(
              'size-[7px] rounded-full',
              styles.unreadDot,
            )}
            aria-hidden
          />
        ))}
    </span>
  </>
);

/* The entire failed row toggles details; the separate paragraph remains selectable. */
const ErrorRunRow: FC<{
  run: ScheduledTaskRunItem;
  errorText: string;
  accessibleName: string;
  isCurrent: boolean;
  timestampClassName: string;
}> = ({ run, errorText, accessibleName, isCurrent, timestampClassName }) => {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const Chevron = expanded ? IconChevronUp : IconChevronDown;
  return (
    <li className="min-w-0">
      <button
        type="button"
        data-run-row
        aria-label={accessibleName}
        aria-current={isCurrent ? 'true' : undefined}
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((value) => !value)}
        className={mergeClasses(
          ROW_CLASS_NAME,
          'cursor-pointer',
          styles.interactiveRow,
          expanded && styles.expandedRow,
          isCurrent && styles.currentRun,
        )}
      >
        <RunContent
          run={run}
          timestampClassName={timestampClassName}
          trailing={
            <Chevron
              size={DIAL_ICON_SIZE.SM}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
            />
          }
        />
      </button>
      <p
        id={detailsId}
        hidden={!expanded}
        className={mergeClasses(
          'select-text whitespace-pre-wrap px-3 py-1 text-[10px] leading-3 [overflow-wrap:anywhere]',
          styles.errorDetails,
        )}
      >
        {errorText}
      </p>
    </li>
  );
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
  const subtitleClassName = typography?.subtitleClassName ?? 'dial-body-text';
  const unreadIndicatorLabel = labels.unreadIndicatorLabel ?? 'Unread';

  const cssVars = buildCssVars({
    '--strhl-success-icon': colors?.successIconColor,
    '--strhl-error-icon': colors?.errorIconColor,
    '--strhl-missed-icon': colors?.missedIconColor,
    '--strhl-subtitle-text': colors?.subtitleTextColor,
    '--strhl-current-run-bg': colors?.currentRunBackground,
    '--strhl-unread-dot': colors?.unreadDotColor,
    '--strhl-row-hover-bg': listStyles?.rowHoverBackground,
    '--strhl-row-focus-bg': listStyles?.rowFocusBackground,
    '--strhl-row-focus-outline': listStyles?.rowFocusOutline,
  });

  const renderRow = (run: ScheduledTaskRunItem) => {
    const statusLabel = labels.runStatusLabels[run.status];
    const isCurrent = run.id === currentRunId;
    /*
     * The row's own aria-label overrides all descendant text per the ARIA
     * accessible-name algorithm, so the unread state must be folded in here
     * rather than left as a nested sr-only span the label would otherwise
     * swallow — the same reason currentRunLabel is appended this way.
     */
    const errorText =
      run.status === ScheduledTaskRunStatus.Error && run.errorText
        ? run.errorText
        : undefined;
    const accessibleNameSuffixes = [
      run.isUnread ? unreadIndicatorLabel : undefined,
      isCurrent ? labels.currentRunLabel : undefined,
    ].filter((suffix): suffix is string => Boolean(suffix));
    const accessibleName = [
      `${statusLabel} ${run.timestampLabel}`,
      ...accessibleNameSuffixes,
    ].join(' — ');
    /*
     * A row without failure details is interactive when its run produced a
     * conversation — an older/missed/in-progress run with no
     * `conversationId` always renders static, even if the host supplies
     * `onRunClick` unconditionally for the whole list.
     */
    const isClickable = Boolean(run.conversationId) && Boolean(onRunClick);

    if (errorText?.trim()) {
      return (
        <ErrorRunRow
          key={run.id}
          run={run}
          errorText={errorText}
          accessibleName={accessibleName}
          isCurrent={isCurrent}
          timestampClassName={runTimestampClassName}
        />
      );
    }

    return (
      <li
        key={run.id}
        {...(isClickable
          ? {
              role: 'button',
              tabIndex: 0,
              onClick: () => onRunClick?.(run),
              onKeyDown: (event: KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRunClick?.(run);
                }
              },
            }
          : {})}
        aria-label={accessibleName}
        aria-current={isCurrent ? 'true' : undefined}
        className={mergeClasses(
          ROW_CLASS_NAME,
          isCurrent && styles.currentRun,
          isClickable && 'cursor-pointer',
          isClickable && styles.interactiveRow,
        )}
      >
        <RunContent run={run} timestampClassName={runTimestampClassName} />
      </li>
    );
  };

  const renderSkeletons = (count: number) =>
    Array.from({ length: count }, (_, index) => (
      <li
        key={`history-skeleton-${index}`}
        aria-hidden="true"
        className={ROW_CLASS_NAME}
      >
        <Skeleton
          variant={SkeletonVariant.Rectangular}
          width="20px"
          height="20px"
          className="shrink-0 rounded-full"
        />
        <Skeleton
          variant={SkeletonVariant.Rectangular}
          width="160px"
          height="16px"
        />
      </li>
    ));

  if (isLoading && items.length === 0) {
    return (
      <ul
        style={
          {
            ...cssVars,
            '--strhl-row-min-height': listStyles?.rowMinHeight,
          } as CSSProperties
        }
        aria-label={labels.historyTitle}
        className="flex flex-col gap-0.5"
      >
        {renderSkeletons(skeletonCount)}
      </ul>
    );
  }

  if (error && items.length === 0) {
    return (
      <div style={cssVars} className="flex flex-col items-start gap-3">
        <p
          role="alert"
          className={mergeClasses(subtitleClassName, styles.subtitleText)}
        >
          {labels.errorLabel}
        </p>
        <GhostButton label={labels.retryLabel} onClick={onRetry} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        style={cssVars}
        className="flex w-full flex-col items-center justify-center gap-2 py-4"
      >
        <IconClipboardX
          size={44}
          stroke={DIAL_KIT_ICON_STROKE}
          className={styles.subtitleText}
          aria-hidden
        />
        <p role="status" className={runTimestampClassName}>
          {labels.emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <ul
      style={
        {
          ...cssVars,
          '--strhl-row-min-height': listStyles?.rowMinHeight,
        } as CSSProperties
      }
      aria-label={labels.historyTitle}
      className="flex flex-col gap-0.5"
    >
      {items.map(renderRow)}
      {isLoadingMore && renderSkeletons(skeletonCount)}
      {error ? (
        <li className="flex flex-col items-start gap-3 px-5 py-2">
          <p
            role="alert"
            className={mergeClasses(subtitleClassName, styles.subtitleText)}
          >
            {labels.errorLabel}
          </p>
          <GhostButton label={labels.retryLabel} onClick={onRetry} />
        </li>
      ) : (
        footer
      )}
    </ul>
  );
};
