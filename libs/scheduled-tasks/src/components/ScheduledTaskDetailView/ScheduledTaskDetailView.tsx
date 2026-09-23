import {
  buildCssVars,
  mergeClasses,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import {
  ButtonVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostButton,
  GhostIconButton,
  NeutralButton,
  Spinner,
  Switch,
  Tabs,
} from '@epam/ai-dial-ui-kit';
import type { TabItem } from '@epam/ai-dial-ui-kit';
import {
  IconArrowNarrowLeft,
  IconPencilMinus,
  IconTrashX,
} from '@tabler/icons-react';
import { type CSSProperties, type FC, type ReactNode, useState } from 'react';
import type { ScheduledTaskDetailViewProps } from '../../models/scheduled-task-detail-view-props';
import { ScheduledTaskDetailTab } from '../../types/scheduled-task-detail-tab';
import { ScheduledTaskHistorySectionVariant } from '../../types/scheduled-task-history-section-variant';
import { ScheduledTaskConfigurationSection } from '../ScheduledTaskConfigurationSection/ScheduledTaskConfigurationSection';
import { ScheduledTaskDetailsSection } from '../ScheduledTaskDetailsSection/ScheduledTaskDetailsSection';
import { ScheduledTaskHistorySection } from '../ScheduledTaskHistorySection/ScheduledTaskHistorySection';
import styles from './ScheduledTaskDetailView.module.scss';

/**
 * Presentational Scheduled Task detail page: a back-navigable header, a
 * Details/Configuration body, and a paginated History panel ("Show more"
 * button, not scroll-triggered). Below the desktop breakpoint the three body
 * sections render as tabs (Details active by default) with the History panel
 * in standard top-to-bottom page flow; at desktop they render as the
 * three-column layout. Field values, runs, and markdown rendering are all
 * supplied by the host app; this component performs no routing, i18n, or
 * network calls, and its only internal state is the selected mobile tab.
 */
export const ScheduledTaskDetailView: FC<ScheduledTaskDetailViewProps> = ({
  labels,
  onBack,
  onEdit,
  onDelete,
  isDeleting = false,
  isDeleted = false,
  isActive,
  isActiveUpdating = false,
  isActiveDisabled = false,
  onActiveChange,
  displayName,
  isLoading = false,
  error,
  onRetry,
  description,
  modelLabel,
  repeatsLabel,
  activeWindowLabel,
  completedLabel,
  nextRunLabel,
  instructionsMarkdown,
  renderInstructions,
  runs,
  runsIsLoading = false,
  runsIsLoadingMore = false,
  runsSkeletonCount = 6,
  runsError,
  onRunsRetry,
  runsLoadMoreError,
  onRunsRetryLoadMore,
  runsHasMore = false,
  onRunsLoadMore,
  onRunClick,
  styles: viewStyles,
  className,
  backIcon,
  layout,
  historyStyles,
}) => {
  const { colors, typography } = viewStyles ?? {};
  const titleClassName = typography?.titleClassName ?? 'dial-h2-text';
  const sectionTitleClassName =
    typography?.sectionTitleClassName ?? 'dial-body-semi-text';
  const fieldLabelClassName =
    typography?.fieldLabelClassName ?? 'dial-tiny-text';
  const fieldValueClassName =
    typography?.fieldValueClassName ?? 'dial-small-text';
  const runTimestampClassName =
    typography?.runTimestampClassName ?? 'dial-small-text';

  const cssVars = buildCssVars({
    '--stdv-bg': colors?.background,
    '--stdv-header-border': colors?.headerBorder,
    '--stdv-details-border': colors?.detailsColumnBorder,
    '--stdv-subtitle-text': colors?.subtitleText,
    '--stdv-history-bg': colors?.historyCardBackground,
  });

  const isMobile = useIsMobile();
  /*
   * Keyed as a plain string so the kit's `onTabChange(tabId: string)` maps
   * straight onto the state setter; the only ids ever stored are the
   * `ScheduledTaskDetailTab` values. Held here — not under the mobile-only
   * branch — so the selection survives a viewport resize across the
   * breakpoint instead of resetting.
   */
  const [activeTabId, setActiveTabId] = useState<string>(
    ScheduledTaskDetailTab.Details,
  );

  const detailTabs: TabItem[] = [
    { id: ScheduledTaskDetailTab.Details, label: labels.detailsTitle },
    {
      id: ScheduledTaskDetailTab.Configuration,
      label: labels.configurationTitle,
    },
    { id: ScheduledTaskDetailTab.History, label: labels.historyTitle },
  ];
  const activeTabLabel =
    detailTabs.find((tab) => tab.id === activeTabId)?.label ??
    labels.detailsTitle;

  /*
   * The section elements are built once and composed by whichever layout the
   * current viewport mounts, so section content cannot drift between the
   * mobile/tab and desktop/column presentations. Only the History section
   * differs by context (card vs flow chrome), so it's a builder.
   */
  const detailsSection = (
    <ScheduledTaskDetailsSection
      labels={{
        descriptionLabel: labels.descriptionLabel,
        modelLabel: labels.modelLabel,
        repeatsLabel: labels.repeatsLabel,
        activeWindowLabel: labels.activeWindowLabel,
        completedFieldLabel: labels.completedFieldLabel,
      }}
      description={description}
      modelLabel={modelLabel}
      repeatsLabel={repeatsLabel}
      activeWindowLabel={activeWindowLabel}
      completedLabel={completedLabel}
      fieldLabelClassName={fieldLabelClassName}
      fieldValueClassName={fieldValueClassName}
    />
  );

  const configurationSection = (
    <ScheduledTaskConfigurationSection
      instructionsLabel={labels.instructionsLabel}
      instructionsMarkdown={instructionsMarkdown}
      renderInstructions={renderInstructions}
      fieldLabelClassName={fieldLabelClassName}
    />
  );

  const buildHistorySection = (
    variant: ScheduledTaskHistorySectionVariant,
  ): ReactNode => (
    <ScheduledTaskHistorySection
      variant={variant}
      labels={{
        historyTitle: labels.historyTitle,
        historyEmptyLabel: labels.historyEmptyLabel,
        historyErrorLabel: labels.historyErrorLabel,
        historyLoadMoreErrorLabel: labels.historyLoadMoreErrorLabel,
        historyRetryLabel: labels.historyRetryLabel,
        historyLoadingMoreLabel: labels.historyLoadingMoreLabel,
        historyShowMoreLabel: labels.historyShowMoreLabel,
        runStatusLabels: labels.runStatusLabels,
        unreadIndicatorLabel: labels.unreadIndicatorLabel,
      }}
      nextRunLabel={nextRunLabel}
      items={runs}
      isLoading={runsIsLoading}
      isLoadingMore={runsIsLoadingMore}
      skeletonCount={runsSkeletonCount}
      error={runsError}
      onRetry={onRunsRetry}
      loadMoreError={runsLoadMoreError}
      onRetryLoadMore={onRunsRetryLoadMore}
      hasMore={runsHasMore}
      onLoadMore={onRunsLoadMore}
      onRunClick={onRunClick}
      runTimestampClassName={runTimestampClassName}
      sectionTitleClassName={sectionTitleClassName}
      colors={colors}
      styles={historyStyles}
    />
  );

  /*
   * Exactly one panel renders at a time. The tab row replaces the section
   * titles below the desktop breakpoint, so the panels carry no headings of
   * their own — the tab is the section's accessible name.
   */
  const renderActiveTabPanel = (): ReactNode => {
    if (activeTabId === ScheduledTaskDetailTab.Configuration) {
      return configurationSection;
    }
    if (activeTabId === ScheduledTaskDetailTab.History) {
      return buildHistorySection(ScheduledTaskHistorySectionVariant.Flow);
    }
    return detailsSection;
  };

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'flex h-full w-full flex-col overflow-y-auto',
        styles.container,
        className,
      )}
    >
      <div
        className={mergeClasses(
          'flex h-16 shrink-0 items-center justify-between gap-2 px-8',
          styles.header,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <GhostIconButton
            icon={
              backIcon === undefined ? (
                <IconArrowNarrowLeft
                  size={DIAL_ICON_SIZE.LG}
                  className="rtl:scale-x-[-1]"
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              ) : (
                backIcon
              )
            }
            aria-label={labels.backAriaLabel}
            onClick={onBack}
          />
          {/*
           * Hidden below the desktop breakpoint, where the standalone title
           * row after the header renders its own copy — exactly one copy of
           * the title is visible at any width.
           */}
          <h1
            className={mergeClasses(
              'truncate',
              styles.desktopTitle,
              titleClassName,
            )}
          >
            {displayName}
          </h1>
          {isDeleted && (
            <span
              className={mergeClasses(
                'shrink-0',
                styles.desktopBadge,
                fieldValueClassName,
                styles.subtitleText,
              )}
            >
              {labels.deletedStateLabel}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!isDeleted && isActive !== undefined && (
            <>
              <Switch
                id="scheduled-task-active-switch"
                labelProps={{ label: labels.activeStatusLabel }}
                isOn={isActive}
                disabled={isActiveUpdating || isActiveDisabled || isDeleting}
                onChange={(value) => onActiveChange?.(value)}
              />
              {isActiveDisabled && labels.isActiveDisabledReason && (
                <span
                  className={mergeClasses(
                    fieldValueClassName,
                    styles.subtitleText,
                  )}
                >
                  {labels.isActiveDisabledReason}
                </span>
              )}
            </>
          )}

          {!isDeleted && onDelete && (
            <GhostButton
              variant={ButtonVariant.Danger}
              label={labels.deleteButtonLabel}
              iconBefore={
                <IconTrashX
                  size={DIAL_ICON_SIZE.SM}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              }
              onClick={onDelete}
              disabled={isDeleting}
              className="shrink-0"
            />
          )}

          {!isDeleted && onEdit && (
            <NeutralButton
              label={labels.editButtonLabel}
              iconBefore={
                <IconPencilMinus
                  size={DIAL_ICON_SIZE.SM}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              }
              onClick={onEdit}
              disabled={isDeleting}
              className="shrink-0"
            />
          )}
        </div>
      </div>

      {/*
       * Standalone title row, visible only below the desktop breakpoint
       * (mobile and tablet), where the in-header title is hidden — exactly
       * one copy of the title is visible at any width.
       */}
      <div
        className={mergeClasses(
          'min-w-0 items-center gap-2 px-8 py-3',
          styles.mobileTitleRow,
        )}
      >
        <h1 className={mergeClasses('truncate', titleClassName)}>
          {displayName}
        </h1>
        {isDeleted && (
          <span
            className={mergeClasses(
              'shrink-0',
              fieldValueClassName,
              styles.subtitleText,
            )}
          >
            {labels.deletedStateLabel}
          </span>
        )}
      </div>

      {labels.activeStatusAnnouncement != null && (
        <span role="status" aria-live="polite" className="sr-only">
          {labels.activeStatusAnnouncement}
        </span>
      )}

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

      {!isLoading &&
        !error &&
        (isMobile ? (
          <div className="flex flex-1 flex-col">
            <Tabs
              ariaLabel={labels.tabsAriaLabel ?? 'Scheduled task sections'}
              className="px-8"
              tabs={detailTabs}
              activeTabId={activeTabId}
              onTabChange={setActiveTabId}
            />
            {/*
             * One panel renders at a time. Its accessible name comes from the
             * active tab's label — the kit's tab elements expose no
             * referenceable ids for `aria-labelledby`.
             */}
            <div
              role="tabpanel"
              aria-label={activeTabLabel}
              className="flex flex-1 flex-col gap-5 px-8 py-6"
            >
              {renderActiveTabPanel()}
            </div>
          </div>
        ) : (
          <div
            style={
              {
                flexDirection: 'row',
                flexWrap: 'wrap',
                '--st-details-width': layout?.detailsWidth,
                '--st-history-width': layout?.historyWidth,
                '--st-history-max-height': layout?.historyMaxHeight,
                '--st-configuration-min-width': layout?.configurationMinWidth,
              } as CSSProperties
            }
            className="flex flex-1"
          >
            <div
              role="group"
              aria-label={labels.detailsTitle}
              style={{
                flex: `0 1 ${layout?.detailsWidth ?? '360px'}`,
                maxWidth: '100%',
              }}
              className={mergeClasses(
                'flex w-full flex-col gap-5 border-e px-8 py-6',
                styles.detailsColumn,
              )}
            >
              <h2 className={sectionTitleClassName}>{labels.detailsTitle}</h2>
              {detailsSection}
            </div>

            <div
              style={{
                flex: `1 1 ${layout?.configurationMinWidth ?? '320px'}`,
                minWidth: 0,
              }}
              className="flex w-full min-w-0 flex-col gap-5 px-8 py-6"
            >
              <h2 className={sectionTitleClassName}>
                {labels.configurationTitle}
              </h2>
              {configurationSection}
            </div>

            <div
              style={{
                flex: `0 1 calc(${layout?.historyWidth ?? '360px'} + 48px)`,
                minWidth: 0,
              }}
              className="flex w-full items-start justify-center p-6"
            >
              {buildHistorySection(ScheduledTaskHistorySectionVariant.Card)}
            </div>
          </div>
        ))}
    </div>
  );
};
