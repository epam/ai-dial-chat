import {
  buildCssVars,
  MDMessageViewer,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  ButtonVariant,
  DIAL_ICON_SIZE,
  Spinner,
  GhostButton,
  GhostIconButton,
  NeutralButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowLeft, IconPencilMinus } from '@tabler/icons-react';
import { type FC } from 'react';
import type { ScheduledTaskDetailViewProps } from '../../models/scheduled-task-detail-view-props';
import { ScheduledTaskRunHistoryList } from '../ScheduledTaskRunHistoryList/ScheduledTaskRunHistoryList';
import styles from './ScheduledTaskDetailView.module.scss';

/**
 * Presentational Scheduled Task detail page: a back-navigable header, a
 * Details/Configuration body, and a paginated History panel ("Show more"
 * button, not scroll-triggered). Field values, runs, and markdown rendering
 * are all supplied by the host app; this component holds no state of its own
 * and performs no routing, i18n, or network calls.
 */
export const ScheduledTaskDetailView: FC<ScheduledTaskDetailViewProps> = ({
  labels,
  onBack,
  onEdit,
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

  const historyFooter =
    onRunsLoadMore && runsHasMore ? (
      <div
        className={mergeClasses(
          'sticky bottom-0 z-10 rounded-b-xl px-6 pb-5 pt-2',
          styles.historyCard,
        )}
      >
        <GhostButton
          variant={ButtonVariant.Primary}
          label={labels.historyShowMoreLabel}
          onClick={onRunsLoadMore}
          disabled={runsIsLoadingMore}
        />
      </div>
    ) : undefined;

  const renderInstructionsContent = (markdown: string) =>
    renderInstructions ? (
      renderInstructions(markdown)
    ) : (
      <MDMessageViewer content={markdown} />
    );

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
          'flex h-16 shrink-0 items-center justify-between gap-2 border-b px-8',
          styles.header,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
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

        {onEdit && (
          <NeutralButton
            label={labels.editButtonLabel}
            iconBefore={
              <IconPencilMinus size={DIAL_ICON_SIZE.SM} aria-hidden />
            }
            onClick={onEdit}
            className="shrink-0"
          />
        )}
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
                'flex max-h-[70vh] w-full flex-col overflow-y-auto rounded-xl shadow-md desktop:w-[360px]',
                styles.historyCard,
              )}
            >
              <div
                className={mergeClasses(
                  'sticky top-0 z-10 flex flex-col gap-1 rounded-t-xl px-6 pb-2 pt-5',
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
              </div>
              <div className="flex flex-1 flex-col gap-4 px-6 pb-2">
                <ScheduledTaskRunHistoryList
                  items={runs}
                  isLoading={runsIsLoading}
                  isLoadingMore={runsIsLoadingMore}
                  skeletonCount={runsSkeletonCount}
                  error={runsError}
                  onRetry={onRunsRetry}
                  onRunClick={onRunClick}
                  labels={{
                    historyTitle: labels.historyTitle,
                    emptyLabel: labels.historyEmptyLabel,
                    errorLabel: labels.historyErrorLabel,
                    retryLabel: labels.historyRetryLabel,
                    runStatusLabels: labels.runStatusLabels,
                  }}
                  styles={{ typography: { runTimestampClassName } }}
                />
              </div>
              {historyFooter}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
