import {
  buildCssVars,
  mergeClasses,
  PanelEmptyState,
} from '@epam/ai-dial-chat-shared';
import { SearchBar } from '@epam/ai-dial-kit';
import {
  ButtonAppearance,
  ButtonDropdown,
  ButtonVariant,
  DIAL_ICON_SIZE,
  Spinner,
  GhostButton,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconCalendarTime, IconPlus } from '@tabler/icons-react';
import { FC, useEffect, useMemo, useRef } from 'react';
import { ScheduledTaskSectionKey } from '../../models/scheduled-task-item';
import { ScheduledTasksProps } from '../../models/scheduled-tasks-props';
import { ScheduledTasksSortKey } from '../../types/scheduled-tasks-sort-key';
import { ScheduledTaskCardGrid } from '../ScheduledTaskCardGrid/ScheduledTaskCardGrid';
import { ScheduledTaskSection } from '../ScheduledTaskSection/ScheduledTaskSection';
import styles from './ScheduledTasks.module.scss';

const SECTION_ORDER: ScheduledTaskSectionKey[] = [
  ScheduledTaskSectionKey.Shared,
  ScheduledTaskSectionKey.MyTasks,
];

const getStatusMessage = (
  isLoading: boolean,
  isLoadingMore: boolean,
  hasError: boolean,
  itemCount: number,
  hasSearchQuery: boolean,
  labels: Pick<
    ScheduledTasksProps['labels'],
    'errorLabel' | 'emptyStateLabel' | 'noResultsLabel' | 'loadingMoreLabel'
  >,
): string | undefined => {
  if (isLoading) return undefined;
  if (isLoadingMore) return labels.loadingMoreLabel;
  if (hasError) return labels.errorLabel;
  if (itemCount > 0) return `${itemCount}`;
  return hasSearchQuery ? labels.noResultsLabel : labels.emptyStateLabel;
};

/* IntersectionObserver against a non-document scroll root is unreliable, so
 * a plain scroll listener on the nearest scrollable ancestor is used instead
 * (same approach as libs/catalog/src/components/ListView/ListView.tsx). */
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

/**
 * Scheduled Tasks page shell: header with title/subtitle/create action, a
 * search + sort toolbar, and a content region that shows a loading spinner,
 * an error with retry, the empty state, a no-results state, or a
 * section-grouped card grid, depending on `isLoading`/`error`/`items`.
 */
export const ScheduledTasks: FC<ScheduledTasksProps> = ({
  labels,
  onCreateClick,
  searchQuery,
  onSearchQueryChange,
  sortKey,
  onSortChange,
  items,
  isLoading = false,
  error,
  onRetry,
  hasMore = false,
  isLoadingMore = false,
  skeletonCount = 6,
  onLoadMore,
  onEdit,
  onRunNow,
  onDelete,
  onCardClick,
  styles: scheduledTasksStyles,
}) => {
  const {
    colors,
    typography,
    emptyStateIconSize = 48,
  } = scheduledTasksStyles ?? {};
  const titleClassName = typography?.titleClassName ?? 'dial-h1-text';
  const subtitleClassName = typography?.subtitleClassName ?? 'dial-body-text';
  const cssVars = buildCssVars({
    '--st-bg': colors?.background,
    '--st-subtitle-text': colors?.subtitleText,
    '--st-sort-text': colors?.sortButtonText,
  });

  const activeSortLabel =
    labels.sortOptions.find((option) => option.key === sortKey)?.label ?? '';

  const sections = useMemo(() => {
    const sectionTitles: Partial<Record<ScheduledTaskSectionKey, string>> = {
      [ScheduledTaskSectionKey.Shared]: labels.sharedSectionTitle,
    };
    return SECTION_ORDER.map((key) => ({
      key,
      title: sectionTitles[key],
      items: items.filter((item) => item.sectionKey === key),
    })).filter((section) => section.items.length > 0);
  }, [items, labels.sharedSectionTitle]);

  const statusMessage = getStatusMessage(
    isLoading,
    isLoadingMore,
    Boolean(error),
    items.length,
    searchQuery.trim().length > 0,
    labels,
  );

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !onLoadMore) return;

    const scrollRoot = findScrollParent(sentinel.parentElement);
    if (!scrollRoot) return;

    const checkVisibility = () => {
      if (isLoadingMore || isLoading || !hasMore) return;
      const rootRect = scrollRoot.getBoundingClientRect();
      const sentinelRect = sentinel.getBoundingClientRect();
      if (
        sentinelRect.top < rootRect.bottom &&
        sentinelRect.bottom > rootRect.top
      ) {
        onLoadMore();
      }
    };

    scrollRoot.addEventListener('scroll', checkVisibility, { passive: true });
    checkVisibility();
    return () => scrollRoot.removeEventListener('scroll', checkVisibility);
    /*
     * `items.length` is intentionally not a dependency here: whenever a page
     * finishes loading and `items` grows, `isLoadingMore` (or `isLoading` for
     * the first page) flips in the same render, which already re-runs this
     * effect and re-checks the newly taller layout. Listing `items.length`
     * too would only force a redundant teardown/re-attach of the listener.
     */
  }, [hasMore, isLoadingMore, isLoading, onLoadMore]);

  const renderContent = () => {
    if (isLoading) {
      return <Spinner />;
    }

    if (error) {
      return (
        <div className="flex flex-col items-center gap-3">
          <p className={mergeClasses(subtitleClassName, styles.subtitle)}>
            {labels.errorLabel}
          </p>
          <GhostButton label={labels.retryLabel} onClick={onRetry} />
        </div>
      );
    }

    if (items.length === 0) {
      if (searchQuery.trim()) {
        return (
          <p className={mergeClasses(subtitleClassName, styles.subtitle)}>
            {labels.noResultsLabel}
          </p>
        );
      }
      return (
        <PanelEmptyState
          icon={
            <IconCalendarTime
              aria-hidden
              size={emptyStateIconSize}
              stroke={1}
            />
          }
          label={labels.emptyStateLabel}
        />
      );
    }

    const lastSectionIndex = sections.length - 1;

    return (
      <div className="flex w-full flex-col gap-6">
        {sections.map((section, index) => (
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
              onCardClick={onCardClick}
              labels={labels.cardLabels}
              trailingSkeletonCount={
                isLoadingMore && index === lastSectionIndex ? skeletonCount : 0
              }
              skeletonStyles={{
                colors: { skeletonColor: colors?.skeletonColor },
              }}
            />
          </ScheduledTaskSection>
        ))}

        <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      </div>
    );
  };

  const isCentered = isLoading || Boolean(error) || items.length === 0;

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'flex h-full w-full flex-col gap-6 overflow-y-auto px-8 py-4',
        styles.container,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 gap-2">
          <h1 className={mergeClasses('truncate', titleClassName)}>
            {labels.title}
          </h1>
          <p
            className={mergeClasses('mt-1', subtitleClassName, styles.subtitle)}
          >
            {labels.subtitle}
          </p>
        </div>

        <PrimaryButton
          label={labels.createButtonLabel}
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
              placeholder: labels.searchPlaceholder,
              ariaLabel: labels.searchAriaLabel,
              clearLabel: labels.clearSearchLabel,
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
        {labels.sortOptions.length > 0 && (
          <ButtonDropdown
            label={activeSortLabel}
            variant={ButtonVariant.Primary}
            appearance={ButtonAppearance.Ghost}
            items={labels.sortOptions.map((option) => ({
              ...option,
              onClick: () => onSortChange(option.key as ScheduledTasksSortKey),
            }))}
          />
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
