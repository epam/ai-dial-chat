import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostButton,
  LinkButton,
  NoDataContent,
  Skeleton,
  SkeletonVariant,
  Spinner,
  LiveRegion,
  LiveRegionElement,
  LiveRegionPoliteness,
} from '@epam/ai-dial-ui-kit';
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconCircleX,
} from '@tabler/icons-react';
import { type CSSProperties, type FC, useId, useState } from 'react';
import type { ScheduledTaskRunHistoryListProps } from '../../models/scheduled-task-run-history-list-props';
import type { ScheduledTaskRunItem } from '../../models/scheduled-task-run-item';
import { ScheduledTaskRunStatus } from '../../types/scheduled-task-run-status';
import styles from './ScheduledTaskRunHistoryList.module.scss';

const RunStatusIcon: FC<{ status: ScheduledTaskRunStatus }> = ({ status }) => {
  switch (status) {
    case ScheduledTaskRunStatus.Success:
      return (
        <IconCheck
          size={DIAL_ICON_SIZE.SM}
          className={styles.successIcon}
          aria-hidden
          stroke={DIAL_KIT_ICON_STROKE}
        />
      );
    case ScheduledTaskRunStatus.Error:
      return (
        <IconCircleX
          size={DIAL_ICON_SIZE.SM}
          className={styles.errorIcon}
          aria-hidden
          stroke={DIAL_KIT_ICON_STROKE}
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
          stroke={DIAL_KIT_ICON_STROKE}
        />
      );
    default:
      return null;
  }
};

/**
 * Presentational, paginated-agnostic list of scheduled-task run rows: status
 * icon, timestamp, optional current-run highlight, expandable failed-run
 * details, skeleton/empty/error states. Holds no fetching or
 * pagination-trigger logic — callers supply a `footer` slot for whichever
 * "load more" affordance they need.
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
    typography?.runTimestampClassName ?? 'dial-small-paragraph-text';
  const runTimestampUnreadClassName =
    typography?.runTimestampUnreadClassName ?? 'dial-small-paragraph-semi-text';
  const subtitleClassName = typography?.subtitleClassName ?? 'dial-body-text';
  const errorDetailsClassName =
    typography?.errorDetailsClassName ?? 'dial-tiny-text';
  const unreadIndicatorLabel = labels.unreadIndicatorLabel ?? 'Unread';
  const openConversationLabel =
    labels.openConversationLabel ?? 'Open conversation';

  const rowIdPrefix = useId();
  const [expandedRunIds, setExpandedRunIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const handleToggleRun = (runId: string) => {
    setExpandedRunIds((previous) => {
      const next = new Set(previous);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  const cssVars = buildCssVars({
    '--strhl-success-icon': colors?.successIconColor,
    '--strhl-error-icon': colors?.errorIconColor,
    '--strhl-missed-icon': colors?.missedIconColor,
    '--strhl-subtitle-text': colors?.subtitleTextColor,
    '--strhl-current-run-bg': colors?.currentRunBackground,
    '--strhl-current-run-subtitle-text': colors?.currentRunSubtitleTextColor,
    '--strhl-unread-dot': colors?.unreadDotColor,
    '--strhl-error-details-text': colors?.errorDetailsTextColor,
    '--strhl-chevron-icon': colors?.chevronIconColor,
    '--strhl-row-hover-bg': listStyles?.rowHoverBackground,
    '--strhl-row-focus-bg': listStyles?.rowFocusBackground,
    '--strhl-row-focus-outline': listStyles?.rowFocusOutline,
    '--strhl-row-expanded-bg': listStyles?.rowExpandedBackground,
  });

  const renderRow = (run: ScheduledTaskRunItem) => {
    const statusLabel = labels.runStatusLabels[run.status];
    const isCurrent = run.id === currentRunId;
    const errorText =
      run.status === ScheduledTaskRunStatus.Error && run.errorText
        ? run.errorText
        : undefined;
    const isExpandable = Boolean(errorText);
    const isExpanded = isExpandable && expandedRunIds.has(run.id);
    /*
     * The row's own aria-label overrides all descendant text per the ARIA
     * accessible-name algorithm, so the unread state must be folded in here
     * rather than left as a nested sr-only span the label would otherwise
     * swallow — the same reason currentRunLabel is appended this way. The
     * error text stays out: an expandable row reveals it in its own region.
     */
    const accessibleNameSuffixes = [
      run.isUnread ? unreadIndicatorLabel : undefined,
      isCurrent ? labels.currentRunLabel : undefined,
    ].filter((suffix): suffix is string => Boolean(suffix));
    const accessibleName = [
      [statusLabel, run.timestampLabel, run.durationLabel]
        .filter(Boolean)
        .join(' '),
      ...accessibleNameSuffixes,
    ].join(' — ');
    /*
     * A row is only ever interactive when its own run produced a
     * conversation — an older/missed/in-progress run with no
     * `conversationId` always renders static, even if the host supplies
     * `onRunClick` unconditionally for the whole list.
     */
    const hasConversationLink =
      Boolean(run.conversationId) && Boolean(onRunClick);
    /* An expandable row is a disclosure, never also the navigation button. */
    const isClickable = !isExpandable && hasConversationLink;
    const isInteractive = isClickable || isExpandable;

    /*
     * `--strhl-row-bleed` (unset: 0) pulls the row's highlight pill out
     * into the host's padding, so its icon lines up with the content edge
     * instead of sitting one pill-padding further in.
     */
    const rowBleedClassName = '-mx-(--strhl-row-bleed,0px)';
    const pillClassName = mergeClasses(
      'flex min-h-(--strhl-row-min-height,32px) items-center justify-between gap-2 rounded-full px-3',
      isCurrent && styles.currentRun,
      isExpanded && styles.expandedRow,
      isInteractive && 'w-full cursor-pointer text-start',
      isInteractive && styles.interactiveRow,
    );

    const rowContent = (
      <>
        <span className="flex min-w-0 items-center gap-1">
          <RunStatusIcon status={run.status} />
          <span className="flex min-w-0 items-center gap-1">
            <span
              className={mergeClasses(
                run.isUnread
                  ? runTimestampUnreadClassName
                  : runTimestampClassName,
                'truncate',
              )}
            >
              {run.timestampLabel}
            </span>
            {run.durationLabel && (
              <span
                className={mergeClasses(
                  runTimestampClassName,
                  styles.subtitleText,
                  'shrink-0',
                )}
              >
                {run.durationLabel}
              </span>
            )}
          </span>
        </span>
        {/*
         * A fixed 12x12 slot is always reserved at the row's end so the
         * timestamp's width stays identical across rows whether it holds the
         * chevron, the unread dot, or nothing. The 16px chevron overflows
         * into the pill's end padding.
         */}
        <span className="relative flex size-3 shrink-0 items-center justify-center">
          {isExpandable && (
            <IconChevronDown
              size={DIAL_ICON_SIZE.SM}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
              className={mergeClasses(
                'shrink-0 transition-transform duration-200 motion-reduce:transition-none',
                styles.chevronIcon,
                isExpanded && 'rotate-180',
              )}
            />
          )}
          {!isExpandable && run.isUnread && (
            <span
              className={mergeClasses(
                'size-[5.33px] rounded-full',
                styles.unreadDot,
              )}
              aria-hidden
            />
          )}
        </span>
      </>
    );

    if (isExpandable) {
      const headerId = `${rowIdPrefix}-${run.id}-header`;
      const detailsId = `${rowIdPrefix}-${run.id}-details`;

      return (
        <li
          key={run.id}
          className={mergeClasses(rowBleedClassName, 'flex flex-col')}
        >
          <button
            type="button"
            id={headerId}
            aria-label={accessibleName}
            aria-current={isCurrent ? 'true' : undefined}
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            className={pillClassName}
            onClick={() => handleToggleRun(run.id)}
          >
            {rowContent}
          </button>
          {/* The same height transition as the kit Accordion: mounted while collapsed, `inert` so nothing inside is reachable. */}
          <div
            inert={!isExpanded}
            className={mergeClasses(
              'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
              isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="min-h-0 overflow-hidden">
              {/* `ps-8` = pill padding + status icon + gap, so the text starts at the timestamp's edge. */}
              <div
                id={detailsId}
                role="region"
                aria-labelledby={headerId}
                className="flex min-w-0 flex-col items-start gap-1 ps-8 pe-3 pt-1 pb-2"
              >
                <p
                  className={mergeClasses(
                    errorDetailsClassName,
                    styles.errorDetailsText,
                    'max-w-full wrap-break-word whitespace-pre-wrap',
                  )}
                >
                  {errorText}
                </p>
                {hasConversationLink && (
                  <LinkButton
                    label={openConversationLabel}
                    onClick={() => onRunClick?.(run)}
                  />
                )}
              </div>
            </div>
          </div>
        </li>
      );
    }

    /* A `role="button"` on the `<li>` would replace its listitem role, which
       leaves the list with children it may not own — so a clickable row nests
       a native button inside the item instead. */
    if (isClickable) {
      return (
        <li key={run.id}>
          <button
            type="button"
            aria-label={accessibleName}
            aria-current={isCurrent ? 'true' : undefined}
            className={mergeClasses(rowBleedClassName, pillClassName)}
            onClick={() => onRunClick?.(run)}
          >
            {rowContent}
          </button>
        </li>
      );
    }

    return (
      <li
        key={run.id}
        aria-label={accessibleName}
        aria-current={isCurrent ? 'true' : undefined}
        className={mergeClasses(rowBleedClassName, pillClassName)}
      >
        {rowContent}
      </li>
    );
  };

  const renderSkeletons = (count: number) =>
    Array.from({ length: count }, (_, index) => (
      <li
        key={`history-skeleton-${index}`}
        aria-hidden="true"
        className="-mx-(--strhl-row-bleed,0px) flex min-h-(--strhl-row-min-height,32px) items-center justify-between gap-2 px-3"
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
          role="status"
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
      <div style={cssVars} className="w-full py-4">
        <NoDataContent
          title={labels.emptyLabel}
          description={labels.emptyDescription}
          live
        />
      </div>
    );
  }

  return (
    <>
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
            <p className={mergeClasses(subtitleClassName, styles.subtitleText)}>
              {labels.errorLabel}
            </p>
            <GhostButton label={labels.retryLabel} onClick={onRetry} />
          </li>
        ) : (
          footer
        )}
      </ul>
      {/* The error row mounts with the failure; this region is mounted with the list so the failure is announced. */}
      <LiveRegion
        politeness={LiveRegionPoliteness.Assertive}
        visuallyHidden
        as={LiveRegionElement.Span}
      >
        {error ? labels.errorLabel : ''}
      </LiveRegion>
    </>
  );
};
