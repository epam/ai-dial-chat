import {
  buildCssVars,
  MDMessageViewer,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  Skeleton,
  SkeletonVariant,
  Spinner,
  GhostButton,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCircleCheck,
  IconCircleX,
} from '@tabler/icons-react';
import { type FC, type KeyboardEvent, useEffect, useRef } from 'react';
import type { ScheduledTaskDetailViewProps } from '../../models/scheduled-task-detail-view-props';
import { ScheduledTaskRunStatus } from '../../types/scheduled-task-run-status';
import styles from './ScheduledTaskDetailView.module.scss';

/* IntersectionObserver against a non-document scroll root is unreliable, so a
 * plain scroll listener on the nearest scrollable ancestor is used instead
 * (same approach as libs/catalog/src/components/ListView/ListView.tsx and
 * ScheduledTasks). Duplicated locally rather than imported cross-lib to keep
 * libs/scheduled-tasks self-contained. */
const findScrollParent = (el: Element | null): Element | null => {
  if (!el || el === document.body) return null;
  const { overflow, overflowY } = getComputedStyle(el);
  if (
    overflow === 'auto' ||
    overflow === 'scroll' ||
    overflowY === 'auto' ||
    overflowY === 'scroll'
  ) {
    return el;
  }
  return findScrollParent(el.parentElement);
};

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
 * Presentational Scheduled Task detail page: a back-navigable header, a
 * Details/Configuration body, and a paginated, infinite-scroll History
 * panel. Field values, runs, and markdown rendering are all supplied by the
 * host app; this component holds no state of its own and performs no
 * routing, i18n, or network calls.
 */
export const ScheduledTaskDetailView: FC<ScheduledTaskDetailViewProps> = ({
  labels,
  onBack,
  displayName,
  isLoading = false,
  error,
  onRetry,
  description,
  modelLabel,
  repeatsLabel,
  activeWindowLabel,
  nextRunLabel,
  instructionsMarkdown,
  renderInstructions,
  runs,
  runsIsLoading = false,
  runsIsLoadingMore = false,
  runsSkeletonCount = 6,
  runsError,
  onRunsRetry,
  runsHasMore = false,
  onRunsLoadMore,
  onRunClick,
  styles: viewStyles,
}) => {
  const { colors, typography } = viewStyles ?? {};
  const titleClassName = typography?.titleClassName ?? 'dial-h1-text';
  const sectionTitleClassName =
    typography?.sectionTitleClassName ?? 'dial-body-semi-text';
  const fieldLabelClassName =
    typography?.fieldLabelClassName ?? 'dial-tiny-text';
  const fieldValueClassName =
    typography?.fieldValueClassName ?? 'dial-body-text';
  const runTimestampClassName =
    typography?.runTimestampClassName ?? 'dial-small-text';

  const cssVars = buildCssVars({
    '--stdv-bg': colors?.background,
    '--stdv-header-border': colors?.headerBorder,
    '--stdv-details-border': colors?.detailsColumnBorder,
    '--stdv-subtitle-text': colors?.subtitleText,
    '--stdv-success-icon': colors?.successIconColor,
    '--stdv-error-icon': colors?.errorIconColor,
    '--stdv-missed-icon': colors?.missedIconColor,
    '--stdv-history-bg': colors?.historyCardBackground,
  });

  const historySentinelRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const sentinel = historySentinelRef.current;
    if (!sentinel || !onRunsLoadMore) return;

    const scrollRoot = findScrollParent(sentinel.parentElement);
    if (!scrollRoot) return;

    const checkVisibility = () => {
      if (runsIsLoadingMore || runsIsLoading || !runsHasMore) return;
      const rootRect = scrollRoot.getBoundingClientRect();
      const sentinelRect = sentinel.getBoundingClientRect();
      if (
        sentinelRect.top < rootRect.bottom &&
        sentinelRect.bottom > rootRect.top
      ) {
        onRunsLoadMore();
      }
    };

    scrollRoot.addEventListener('scroll', checkVisibility, { passive: true });
    checkVisibility();
    return () => scrollRoot.removeEventListener('scroll', checkVisibility);
  }, [runsHasMore, runsIsLoadingMore, runsIsLoading, onRunsLoadMore]);

  const renderInstructionsContent = (markdown: string) =>
    renderInstructions ? (
      renderInstructions(markdown)
    ) : (
      <MDMessageViewer content={markdown} />
    );

  const renderRunRow = (run: (typeof runs)[number]) => {
    const statusLabel = labels.runStatusLabels[run.status];
    const accessibleName = `${statusLabel} ${run.timestampLabel}`;
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
        className={mergeClasses(
          'flex h-8 items-center justify-between gap-2 rounded-full pe-2 ps-5',
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

  const renderHistorySkeletons = (count: number) =>
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

  const renderHistoryContent = () => {
    if (runsIsLoading && runs.length === 0) {
      return (
        <ul aria-label={labels.historyTitle}>
          {renderHistorySkeletons(runsSkeletonCount)}
        </ul>
      );
    }

    if (runsError) {
      return (
        <div className="flex flex-col items-start gap-3">
          <p className={mergeClasses(fieldValueClassName, styles.subtitleText)}>
            {labels.historyErrorLabel}
          </p>
          <GhostButton label={labels.historyRetryLabel} onClick={onRunsRetry} />
        </div>
      );
    }

    if (runs.length === 0) {
      return (
        <p className={mergeClasses(fieldValueClassName, styles.subtitleText)}>
          {labels.historyEmptyLabel}
        </p>
      );
    }

    return (
      <ul aria-label={labels.historyTitle}>
        {runs.map(renderRunRow)}
        {runsIsLoadingMore && renderHistorySkeletons(runsSkeletonCount)}
        <li ref={historySentinelRef} aria-hidden className="h-px w-full" />
      </ul>
    );
  };

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'flex h-full w-full flex-col overflow-y-auto',
        styles.container,
      )}
    >
      <div
        className={mergeClasses(
          'flex h-16 shrink-0 items-center gap-2 border-b px-8',
          styles.header,
        )}
      >
        <GhostIconButton
          icon={
            <IconArrowLeft
              size={DIAL_ICON_SIZE.LG}
              className="rtl:scale-x-[-1]"
              aria-hidden
            />
          }
          aria-label={labels.backAriaLabel}
          onClick={onBack}
        />
        <h1 className={mergeClasses('truncate', titleClassName)}>
          {displayName}
        </h1>
      </div>

      {isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      )}

      {!isLoading && error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className={mergeClasses(fieldValueClassName, styles.subtitleText)}>
            {labels.errorLabel}
          </p>
          <GhostButton label={labels.retryLabel} onClick={onRetry} />
        </div>
      )}

      {!isLoading && !error && (
        <div className="flex flex-1 flex-col desktop:flex-row">
          <div
            role="group"
            aria-label={labels.detailsTitle}
            className={mergeClasses(
              'flex w-full flex-col gap-5 border-e px-8 py-6 desktop:w-[360px] desktop:shrink-0',
              styles.detailsColumn,
            )}
          >
            <h2 className={sectionTitleClassName}>{labels.detailsTitle}</h2>

            {description && (
              <div className="flex flex-col gap-1">
                <span className={fieldLabelClassName}>
                  {labels.descriptionLabel}
                </span>
                <p className={fieldValueClassName}>{description}</p>
              </div>
            )}

            {modelLabel && (
              <div className="flex flex-col gap-1">
                <span className={fieldLabelClassName}>{labels.modelLabel}</span>
                <p className={fieldValueClassName}>{modelLabel}</p>
              </div>
            )}

            {repeatsLabel && (
              <div className="flex flex-col gap-1">
                <span className={fieldLabelClassName}>
                  {labels.repeatsLabel}
                </span>
                <p className={fieldValueClassName}>{repeatsLabel}</p>
              </div>
            )}

            {activeWindowLabel && (
              <div className="flex flex-col gap-1">
                <span className={fieldLabelClassName}>
                  {labels.activeWindowLabel}
                </span>
                <p className={fieldValueClassName}>{activeWindowLabel}</p>
              </div>
            )}
          </div>

          <div className="flex w-full min-w-0 flex-1 flex-col gap-5 px-8 py-6">
            <h2 className={sectionTitleClassName}>
              {labels.configurationTitle}
            </h2>

            <div
              role="group"
              aria-label={labels.instructionsLabel}
              className="flex flex-col gap-1"
            >
              <span className={fieldLabelClassName}>
                {labels.instructionsLabel}
              </span>
              {instructionsMarkdown &&
                renderInstructionsContent(instructionsMarkdown)}
            </div>
          </div>

          <div className="flex w-full justify-center p-6 desktop:w-auto desktop:items-start">
            <div
              className={mergeClasses(
                'flex w-full flex-col gap-4 overflow-y-auto rounded-xl px-6 py-5 shadow-md desktop:max-h-[70vh] desktop:w-[360px]',
                styles.historyCard,
              )}
            >
              <h2 className={sectionTitleClassName}>{labels.historyTitle}</h2>
              {nextRunLabel && (
                <p
                  className={mergeClasses(
                    runTimestampClassName,
                    styles.subtitleText,
                  )}
                >
                  {nextRunLabel}
                </p>
              )}
              {labels.historyLoadingMoreLabel && (
                <span role="status" aria-live="polite" className="sr-only">
                  {runsIsLoadingMore ? labels.historyLoadingMoreLabel : ''}
                </span>
              )}
              {renderHistoryContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
