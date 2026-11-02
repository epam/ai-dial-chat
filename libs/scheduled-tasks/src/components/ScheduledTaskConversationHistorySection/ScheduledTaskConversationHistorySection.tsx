import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Accordion,
  ButtonVariant,
  GhostButton,
  LiveRegion,
  LiveRegionElement,
} from '@epam/ai-dial-ui-kit';
import { useEffect, useState, type FC } from 'react';
import type { ScheduledTaskRunItem } from '../../models/scheduled-task-run-item';
import type { ScheduledTaskRunStatus } from '../../types/scheduled-task-run-status';
import { ScheduledTaskRunHistoryList } from '../ScheduledTaskRunHistoryList/ScheduledTaskRunHistoryList';
import { SectionAccordionTitle } from '../SectionAccordionTitle/SectionAccordionTitle';
import styles from './ScheduledTaskConversationHistorySection.module.scss';

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
  /** Message shown instead of the run list while `isUnavailable` is `true`, e.g. "History is unavailable". */
  unavailableLabel?: string;
  /** Label for the "Show more" footer button, rendered while `hasMore` is `true` and `isLoading` is `false`. Required when `onLoadMore` is supplied. */
  showMoreLabel?: string;
  /** Per-status label used to build each run row's accessible name, e.g. `{ success: 'Succeeded', ... }`. */
  runStatusLabels: Record<ScheduledTaskRunStatus, string>;
  /** Appended to the current run row's accessible name, e.g. "Current run". Omit to skip the accessible current-run suffix. */
  currentRunLabel?: string;
  /** `sr-only` label announced alongside the unread-dot indicator on a run row whose `isUnread` is `true`. Defaults to `'Unread'`. */
  unreadIndicatorLabel?: string;
}

/** Color overrides for {@link ScheduledTaskConversationHistorySection}. */
export interface ScheduledTaskConversationHistorySectionColors {
  /** Text color of the unavailable message. Defaults to `--text-secondary`. */
  unavailableText?: string;
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
  /** When `true`, the history exists but cannot be shown (e.g. a task shared by its owner): `labels.unavailableLabel` replaces the run list, `error`, and the retry action. Defaults to `false`. */
  isUnavailable?: boolean;
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
  /** Typography class applied to the unavailable message. Defaults to `'dial-body-text'`. */
  unavailableTextClassName?: string;
  /** Color overrides, applied as CSS custom properties. */
  colors?: ScheduledTaskConversationHistorySectionColors;
}

/**
 * History accordion of a task conversation's sources panel: the schedule's
 * paginated runs with the current run highlighted and a Show-more footer, or
 * the scoped unavailable message (without a retry action) while
 * `isUnavailable` is set.
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
  isUnavailable = false,
  hasMore = false,
  onLoadMore,
  currentRunId,
  onRunClick,
  labels,
  titleClassName = 'dial-tiny-semi-text',
  contentClassName = 'ps-3',
  unavailableTextClassName = 'dial-body-text',
  colors,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    setIsExpanded(true);
  }, [scheduleId]);

  const footer =
    hasMore && !isLoading && onLoadMore && labels.showMoreLabel ? (
      <li className="pt-2">
        <GhostButton
          variant={ButtonVariant.Primary}
          label={labels.showMoreLabel}
          onClick={onLoadMore}
          disabled={isLoadingMore}
        />
      </li>
    ) : undefined;

  return (
    <Accordion
      title={
        <SectionAccordionTitle className={titleClassName}>
          {labels.title}
        </SectionAccordionTitle>
      }
      expanded={isExpanded}
      onToggle={setIsExpanded}
      /* The kit's content region pads px-4 (16px); the design narrows the History rows' start inset to 12px. */
      contentClassName={contentClassName}
    >
      {/* The status region stays mounted in every state, so history turning
          unavailable while the section is open is announced. */}
      <LiveRegion
        as={LiveRegionElement.P}
        className={mergeClasses(
          unavailableTextClassName,
          styles.unavailableText,
        )}
        style={buildCssVars({
          '--stch-unavailable-text': colors?.unavailableText,
        })}
      >
        {isUnavailable && labels.unavailableLabel}
      </LiveRegion>
      {!isUnavailable && (
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
      )}
    </Accordion>
  );
};
