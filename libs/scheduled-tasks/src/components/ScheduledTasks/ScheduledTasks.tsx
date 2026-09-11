import {
  buildCssVars,
  mergeClasses,
  PanelEmptyState,
} from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ButtonDropdown,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  DropdownItem,
  ElementSize,
  GhostButton,
  MenuItemMark,
  PrimaryButton,
  Search,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconCalendarTime, IconPlus } from '@tabler/icons-react';
import {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ScheduledTasksProps } from '../../models/scheduled-tasks-props';
import { ScheduledTasksSortKey } from '../../types/scheduled-tasks-sort-key';
import { ScheduledTaskCardGrid } from '../ScheduledTaskCardGrid/ScheduledTaskCardGrid';
import styles from './ScheduledTasks.module.scss';

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
 * search + sort toolbar, an optional `banner` slot, and a content region
 * that shows a loading spinner, an error with retry, the empty state, a
 * no-results state, or a flat card grid, depending on
 * `isLoading`/`error`/`items`.
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
  onCardClick,
  banner,
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

  const handleSearchChange = (value?: string) => {
    onSearchQueryChange(value ?? '');
  };

  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const sortControlRef = useRef<HTMLDivElement | null>(null);

  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
  }, []);

  /*
   * When the search is focused at phone widths (`.sortControlHidden` in the
   * SCSS), the sort trigger is display:none'd while its portaled popup can
   * stay open — the kit's Dropdown closes on outside pointer press only, not
   * on keyboard focus. Close the menu exactly in that case, detected from the
   * DOM rather than a second copy of the px cutoff, so from 768px up — where
   * the control never hides — search focus leaves an open sort menu alone.
   */
  useLayoutEffect(() => {
    const sortControl = sortControlRef.current;
    if (
      isSearchFocused &&
      isSortMenuOpen &&
      sortControl != null &&
      sortControl.offsetParent == null
    ) {
      setIsSortMenuOpen(false);
    }
  }, [isSearchFocused, isSortMenuOpen]);

  /* Falls back to the control's own name so the trigger is never a button with
   * no accessible name, which is what an unrecognised sortKey would produce —
   * the kit's `Button` derives its `aria-label` from `label` and overrides any
   * the caller passes, so the visible label is the only name available. */
  const activeSortLabel =
    labels.sortOptions.find((option) => option.value === sortKey)?.label ??
    labels.sortLabel;

  /*
   * The host passes the values alone; the marking and the click belong here,
   * so the trigger and the menu cannot disagree about which order is applied.
   */
  const sortItems = useMemo<DropdownItem[]>(
    () =>
      labels.sortOptions.map((option) => ({
        key: option.value,
        label: option.label,
        mark: MenuItemMark.Check,
        checked: option.value === sortKey,
        onClick: () => onSortChange(option.value as ScheduledTasksSortKey),
      })),
    [labels.sortOptions, sortKey, onSortChange],
  );

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

    return (
      <div className="flex w-full flex-col gap-6">
        <ScheduledTaskCardGrid
          items={items}
          searchQuery={searchQuery}
          onCardClick={onCardClick}
          labels={labels.cardLabels}
          trailingSkeletonCount={isLoadingMore ? skeletonCount : 0}
          skeletonStyles={{
            colors: { skeletonColor: colors?.skeletonColor },
          }}
        />

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
          /* The kit wraps `label` in its own span (carrying `textClassName`)
           * that stays a flex item even when its content is hidden — the gap
           * then pushes the icon off-center. Hiding the wrapper span itself
           * below the desktop breakpoint removes the flex item entirely, so
           * the plus icon alone carries the action, centered. `aria-label`
           * keeps the accessible name stable at every width. */
          label={labels.createButtonLabel}
          textClassName="hidden desktop:inline"
          aria-label={labels.createButtonLabel}
          iconBefore={
            <IconPlus
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          onClick={onCreateClick}
          className={mergeClasses('shrink-0', styles.createButton)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="search" className="flex-1">
          <Search
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={labels.searchPlaceholder}
            clearLabel={labels.clearSearchLabel}
            aria-label={labels.searchAriaLabel}
            size={ElementSize.Large}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          />
        </div>
        {labels.sortOptions.length > 0 && (
          /* The trigger shows the applied order and the menu marks it with the
             design's trailing check. */

          /* While the search is focused at phone widths (<768px, see
           * `.sortControlHidden`) the sort control is hidden and the search
           * (flex-1) expands to the full row; from 768px up both controls
           * stay visible regardless of focus. */
          <div
            ref={sortControlRef}
            className={mergeClasses(
              isSearchFocused && styles.sortControlHidden,
            )}
          >
            <ButtonDropdown
              items={sortItems}
              label={activeSortLabel}
              variant={ButtonVariant.Primary}
              appearance={ButtonAppearance.Ghost}
              className={styles.sortButton}
            />
          </div>
        )}
      </div>

      {banner}

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
