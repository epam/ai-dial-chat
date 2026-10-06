import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Accordion, GhostButton } from '@epam/ai-dial-ui-kit';
import { useEffect, useState, type FC } from 'react';
import type { ScheduledTaskRunItem } from '../../models/scheduled-task-run-item';
import type { ScheduledTaskRunStatus } from '../../types/scheduled-task-run-status';
import { ScheduledTaskRunHistoryList } from '../ScheduledTaskRunHistoryList/ScheduledTaskRunHistoryList';

/**
 * Localized labels used by the
 * {@link ScheduledTaskConversationHistorySection} component.
 */
export interface ScheduledTaskConversationHistorySectionLabels {
  /** Accordion title, e.g. "History". Also applied as the run list's accessible name. */
  title: string;
  /** Message shown when the schedule has no runs yet. */
  emptyLabel: string;
  /** Message shown alongside the retry action when `error` is set. */
  errorLabel: string;
  /** Label for the retry action shown alongside `error`. */
  retryLabel: string;
  /** Label for the "Show more" footer button, rendered while `hasMore` is `true` and `isLoading` is `false`. Required when `onLoadMore` is supplied. */
  showMoreLabel?: string;
  /** Per-status label used to build each run row's accessible name, e.g. `{ success: 'Succeeded', ... }`. */
  runStatusLabels: Record<ScheduledTaskRunStatus, string>;
  /** Appended to the current run row's accessible name, e.g. "Current run". Omit to skip the accessible current-run suffix. */
  currentRunLabel?: string;
  /** `sr-only` label announced alongside the unread-dot indicator on a run row whose `isUnread` is `true`. Defaults to `'Unread'`. */
  unreadIndicatorLabel?: string;
}

/** Props for the {@link ScheduledTaskConversationHistorySection} component. */
export interface ScheduledTaskConversationHistorySectionProps {
  /** Active schedule id — the expanded state resets whenever it changes. Omit when no schedule is active. */
  scheduleId?: string;
  /** Runs to render, in the order they should display (server order, newest first). */
  items: ScheduledTaskRunItem[];
  /** When `true` and `items` is empty, shows `skeletonCount` placeholder rows instead of `labels.emptyLabel`. Defaults to `false`. */
  isLoading?: boolean;
  /** When `true`, `skeletonCount` placeholder rows render below the loaded rows while the next page is fetched. Defaults to `false`. */
  isLoadingMore?: boolean;
  /** Number of placeholder rows shown during `isLoading`/`isLoadingMore`. Defaults to `6`. */
  skeletonCount?: number;
  /** When set, shows an error message and retry action instead of `items`. */
  error?: Error | null;
  /** Called when the user activates the retry action shown alongside `error`. */
  onRetry?: () => void;
  /** Whether another page of `items` is available beyond what has been loaded. Defaults to `false`. */
  hasMore?: boolean;
  /** Called when the user activates the "Show more" footer button. The button renders while `hasMore` is `true` and `isLoading` is `false`. */
  onLoadMore?: () => void;
  /** The `id` of the run to render with the current-run visual and accessible treatment. Omit to mark no row as current. */
  currentRunId?: string;
  /** Called with the run when the user clicks a row whose `conversationId` is set. Rows without a `conversationId` never invoke this, regardless of whether it is supplied. */
  onRunClick?: (run: ScheduledTaskRunItem) => void;
  /** Localized labels. */
  labels: ScheduledTaskConversationHistorySectionLabels;
  /** CSS class applied to the accordion title. Defaults to `'dial-tiny-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to the accordion's content region. Defaults to `'ps-3'`. */
  contentClassName?: string;
}

/**
 * History accordion of a task conversation's sources panel: the schedule's
 * paginated runs with the current run highlighted and a Show-more footer.
 * Expanded by default; resets to expanded whenever `scheduleId` changes.
 */
export const ScheduledTaskConversationHistorySection: FC<
  ScheduledTaskConversationHistorySectionProps
> = ({
  scheduleId,
  items,
  isLoading = false,
  isLoadingMore = false,
  skeletonCount = 6,
  error,
  onRetry,
  hasMore = false,
  onLoadMore,
  currentRunId,
  onRunClick,
  labels,
  titleClassName = 'dial-tiny-semi-text',
  contentClassName = 'ps-3',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    setIsExpanded(true);
  }, [scheduleId]);

  const footer =
    hasMore && !isLoading && onLoadMore && labels.showMoreLabel ? (
      <li className="pt-2">
        <GhostButton
          label={labels.showMoreLabel}
          onClick={onLoadMore}
          disabled={isLoadingMore}
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
        <span className={mergeClasses(titleClassName, 'block truncate py-1')}>
          {labels.title}
        </span>
      }
      expanded={isExpanded}
      onToggle={setIsExpanded}
      /* The kit's content region pads px-4 (16px); the design narrows the History rows' start inset to 12px. */
      contentClassName={contentClassName}
    >
      <ScheduledTaskRunHistoryList
        items={items}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        skeletonCount={skeletonCount}
        error={error}
        onRetry={onRetry}
        currentRunId={currentRunId}
        onRunClick={onRunClick}
        footer={footer}
        labels={{
          historyTitle: labels.title,
          emptyLabel: labels.emptyLabel,
          errorLabel: labels.errorLabel,
          retryLabel: labels.retryLabel,
          runStatusLabels: labels.runStatusLabels,
          currentRunLabel: labels.currentRunLabel,
          unreadIndicatorLabel: labels.unreadIndicatorLabel,
        }}
      />
    </Accordion>
  );
};
