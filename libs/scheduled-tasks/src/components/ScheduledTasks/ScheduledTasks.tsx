import { mergeClasses, PanelEmptyState } from '@epam/ai-dial-chat-shared';
import { GhostButton, PrimaryButton, SearchBar } from '@epam/ai-dial-kit';
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialSpinner,
} from '@epam/ai-dial-ui-kit';
import {
  IconArrowsSort,
  IconCalendarTime,
  IconCheck,
  IconChevronUp,
  IconPlus,
} from '@tabler/icons-react';
import { FC, useMemo } from 'react';
import type { ScheduledTaskSectionKey } from '../../models/scheduled-task-item';
import { ScheduledTasksProps } from '../../models/scheduled-tasks-props';
import {
  filterScheduledTaskItems,
  sortScheduledTaskItems,
} from '../../utils/filter-sort';
import { ScheduledTaskCardGrid } from '../ScheduledTaskCardGrid/ScheduledTaskCardGrid';
import { ScheduledTaskSection } from '../ScheduledTaskSection/ScheduledTaskSection';

const SECTION_ORDER: ScheduledTaskSectionKey[] = ['shared', 'myTasks'];

/**
 * Scheduled Tasks page shell: header with title/subtitle/create action, a
 * search + sort toolbar, and a content region that shows a loading spinner,
 * an error with retry, the empty state, a no-results state, or a
 * section-grouped card grid, depending on `isLoading`/`error`/`items`.
 */
export const ScheduledTasks: FC<ScheduledTasksProps> = ({
  texts,
  onCreateClick,
  searchQuery,
  onSearchQueryChange,
  sortKey,
  onSortChange,
  items,
  isLoading = false,
  error,
  onRetry,
  onEdit,
  onRunNow,
  onDelete,
  styles: scheduledTasksStyles,
}) => {
  const containerClassName =
    scheduledTasksStyles?.containerClassName ?? 'bg-layer-5';
  const titleClassName = scheduledTasksStyles?.titleClassName ?? 'dial-h1-text';
  const subtitleClassName =
    scheduledTasksStyles?.subtitleClassName ?? 'dial-body-text text-secondary';
  const sortButtonClassName =
    scheduledTasksStyles?.sortButtonClassName ?? 'text-accent-primary';
  const emptyStateIconSize = scheduledTasksStyles?.emptyStateIconSize ?? 48;

  const activeSortLabel =
    texts.sortOptions.find((option) => option.key === sortKey)?.label ?? '';

  const visibleItems = useMemo(
    () =>
      sortScheduledTaskItems(
        filterScheduledTaskItems(items, searchQuery),
        sortKey,
      ),
    [items, searchQuery, sortKey],
  );

  const sections = useMemo(() => {
    const sectionTitles: Record<ScheduledTaskSectionKey, string> = {
      shared: texts.sharedSectionTitle,
      myTasks: texts.myTasksSectionTitle,
    };
    return SECTION_ORDER.map((key) => ({
      key,
      title: sectionTitles[key],
      items: visibleItems.filter((item) => item.sectionKey === key),
    })).filter((section) => section.items.length > 0);
  }, [visibleItems, texts.sharedSectionTitle, texts.myTasksSectionTitle]);

  const cardTexts = {
    newBadgeLabel: texts.cardNewBadgeLabel,
    actionsLabel: texts.cardActionsLabel,
    editActionLabel: texts.cardEditActionLabel,
    runNowActionLabel: texts.cardRunNowActionLabel,
    deleteActionLabel: texts.cardDeleteActionLabel,
  };

  const statusMessage = isLoading
    ? undefined
    : error
      ? texts.errorLabel
      : items.length === 0
        ? texts.emptyStateLabel
        : visibleItems.length === 0
          ? texts.noResultsLabel
          : `${visibleItems.length}`;

  const renderContent = () => {
    if (isLoading) {
      return <DialSpinner />;
    }

    if (error) {
      return (
        <div className="flex flex-col items-center gap-3">
          <p className={subtitleClassName}>{texts.errorLabel}</p>
          <GhostButton label={texts.retryLabel} onClick={onRetry} />
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <PanelEmptyState
          icon={
            <IconCalendarTime
              aria-hidden
              size={emptyStateIconSize}
              stroke={1}
            />
          }
          label={texts.emptyStateLabel}
        />
      );
    }

    if (visibleItems.length === 0) {
      return <p className={subtitleClassName}>{texts.noResultsLabel}</p>;
    }

    return (
      <div className="flex w-full flex-col gap-6">
        {sections.map((section) => (
          <ScheduledTaskSection
            key={section.key}
            title={section.title}
            count={section.items.length}
          >
            <ScheduledTaskCardGrid
              items={section.items}
              searchQuery={searchQuery}
              onEdit={onEdit}
              onRunNow={onRunNow}
              onDelete={onDelete}
              texts={cardTexts}
            />
          </ScheduledTaskSection>
        ))}
      </div>
    );
  };

  const isCentered =
    isLoading ||
    Boolean(error) ||
    items.length === 0 ||
    visibleItems.length === 0;

  return (
    <div
      className={mergeClasses(
        'flex h-full w-full flex-col gap-6 overflow-y-auto px-8 py-4',
        containerClassName,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 gap-2">
          <h1 className={mergeClasses('truncate', titleClassName)}>
            {texts.title}
          </h1>
          <p className={mergeClasses('mt-1', subtitleClassName)}>
            {texts.subtitle}
          </p>
        </div>

        <PrimaryButton
          label={texts.createButtonLabel}
          iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} aria-hidden />}
          onClick={onCreateClick}
          className="shrink-0"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <SearchBar
            value={searchQuery}
            onChange={onSearchQueryChange}
            labels={{
              placeholder: texts.searchPlaceholder,
              ariaLabel: texts.searchAriaLabel,
              clearLabel: texts.clearSearchLabel,
            }}
            iconSize={18}
            iconStrokeWidth={1.8}
            styles={{
              containerClassName: 'h-[50px] w-full rounded-xl px-[18px]',
              inputClassName: 'text-[15px]',
              clearButtonClassName: 'size-11 desktop:size-auto',
            }}
          />
        </div>

        {texts.sortOptions.length > 0 && (
          <DialDropdown
            matchReferenceWidth={false}
            placement="bottom-end"
            listClassName="cp-dropdown-overlay"
            items={texts.sortOptions.map((option) => ({
              key: option.key,
              label: (
                <span className="flex w-full items-center justify-between gap-2">
                  {option.label}
                  {option.key === sortKey && (
                    <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden />
                  )}
                </span>
              ),
              onClick: () => onSortChange(option.key),
            }))}
          >
            <GhostButton
              label={activeSortLabel}
              aria-label={texts.sortLabel}
              className={mergeClasses('rounded-[4px]', sortButtonClassName)}
              iconBefore={<IconArrowsSort size={20} aria-hidden />}
              iconAfter={<IconChevronUp size={20} aria-hidden />}
            />
          </DialDropdown>
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </span>

      <div
        className={mergeClasses(
          'mx-auto flex size-full w-full max-w-[1180px] flex-col',
          isCentered && 'items-center justify-center',
        )}
      >
        {renderContent()}
      </div>
    </div>
  );
};
