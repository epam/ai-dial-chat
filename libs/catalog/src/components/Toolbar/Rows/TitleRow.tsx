import {
  mergeClasses,
  SortMenuButton,
  useIsPhone,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  GhostIconButton,
  Search,
  SegmentedControl,
  SegmentedControlItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconAdjustmentsHorizontal,
  IconLayoutGrid,
  IconLayoutList,
} from '@tabler/icons-react';
import {
  FC,
  useCallback,
  useMemo,
  useState,
  useLayoutEffect,
  useRef,
} from 'react';
import { DEFAULT_BROWSE_SETTINGS_LABELS } from '../../../constants/browse-settings';
import {
  BrowseSettingsSheetLabels,
  ToolbarProps,
} from '../../../models/toolbar-props';
import type { CatalogFolderSelection } from '../../../types/catalog-folders';
import { CatalogViewMode } from '../../../types/view-mode';
import { resolveCatalogFolderLabels } from '../../../utils/catalog-folders';
import { AppliedTopicTags } from '../../AppliedTopicTags/AppliedTopicTags';
import { Filter } from '../../Filter/Filter';
import { FoldersButton } from '../../FoldersButton/FoldersButton';
import { BrowseSettingsSheet } from '../BrowseSettingsSheet';
import styles from '../Toolbar.module.scss';
import { CatalogFolderHeader } from './CatalogFolderHeader';

/** Props for TitleRow: the toolbar props, which `Toolbar` forwards unchanged. */
type TitleRowProps = ToolbarProps;

/* Shared, never mutated: the filter components copy before editing. */
const EMPTY_FILTERS = new Set<string>();
const ALL_ENTITIES: CatalogFolderSelection = { path: [] };
const noop = () => undefined;

/** Browse section header: folder heading and Folders control, then search with view, sort and filter (or the phone settings button), then the applied-topic tags. */
export const TitleRow: FC<TitleRowProps> = ({
  totalCount,
  viewMode,
  onViewModeChange,
  onViewModeIntent,
  title,
  browseHeaderRenderer,
  styles: browseStyles,
  query,
  onQueryChange,
  searchPlaceholder,
  searchInputRef,
  gridViewLabel = 'Grid view',
  listViewLabel = 'List view',
  viewToggleLabel = 'View mode',
  sortKey,
  sortOptions,
  onSortChange,
  sortLabel = 'Sort',
  filters,
  onFiltersChange,
  filterValues,
  filterTopicsLabel,
  filterLabel,
  filterClearAllLabel,
  appliedTopicsLabel,
  formatRemoveTopicLabel,
  browseSettingsLabels,
  folderTree,
  folderSelection = ALL_ENTITIES,
  onFolderSelectionChange,
  folderLabels,
}) => {
  const isPhone = useIsPhone();
  const rowRef = useRef<HTMLDivElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopControlsRef = useRef<HTMLDivElement>(null);
  const hadFocusRef = useRef(false);
  const previousPhoneRef = useRef(isPhone);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  useLayoutEffect(() => {
    if (previousPhoneRef.current === isPhone) return;
    previousPhoneRef.current = isPhone;
    if (
      isSettingsOpen ||
      (hadFocusRef.current && document.activeElement === document.body)
    ) {
      setIsSettingsOpen(false);
      if (isPhone) settingsTriggerRef.current?.focus();
      else
        desktopControlsRef.current
          ?.querySelector<HTMLElement>('[role="radio"]')
          ?.focus();
    }
  }, [isPhone, isSettingsOpen]);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const appliedFilters = filters ?? EMPTY_FILTERS;
  const handleFiltersChange = onFiltersChange ?? noop;
  const isFilterActive = appliedFilters.size > 0;
  const sheetLabels: BrowseSettingsSheetLabels = {
    ...DEFAULT_BROWSE_SETTINGS_LABELS,
    topics: filterTopicsLabel ?? DEFAULT_BROWSE_SETTINGS_LABELS.topics,
    clearAll: filterClearAllLabel ?? DEFAULT_BROWSE_SETTINGS_LABELS.clearAll,
    ...browseSettingsLabels,
  };
  const resolvedFolderLabels = useMemo(
    () => resolveCatalogFolderLabels(folderLabels, title),
    [folderLabels, title],
  );
  const handleFolderChange = onFolderSelectionChange ?? noop;

  const viewModeItems = useMemo<SegmentedControlItem<CatalogViewMode>[]>(
    () => [
      {
        value: CatalogViewMode.Grid,
        icon: (
          <IconLayoutGrid
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
        'aria-label': gridViewLabel,
      },
      {
        value: CatalogViewMode.Cards,
        icon: (
          <IconLayoutList
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
        'aria-label': listViewLabel,
      },
    ],
    [gridViewLabel, listViewLabel],
  );

  const handleChange = (nextValue?: string) => {
    onQueryChange(nextValue ?? '');
  };

  const handleSortChange = useCallback(
    (nextSortKey: string) => onSortChange?.(nextSortKey),
    [onSortChange],
  );

  return (
    <div
      ref={rowRef}
      onFocusCapture={() => {
        hadFocusRef.current = true;
      }}
      onBlurCapture={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          hadFocusRef.current = false;
        }
      }}
      className="flex flex-col gap-3"
    >
      {/* Row 1 holds the folder heading and the Folders control; the view
          toggle and the sort sit in the search row next to the controls they
          work with. */}
      <div className="flex min-w-0 items-center gap-x-2 gap-y-3">
        {browseHeaderRenderer ?? (
          <CatalogFolderHeader
            tree={folderTree ?? []}
            selection={folderSelection}
            onChange={handleFolderChange}
            totalCount={totalCount}
            labels={resolvedFolderLabels}
            styles={browseStyles}
          />
        )}
        {folderTree != null && (
          <FoldersButton
            tree={folderTree}
            selection={folderSelection}
            onChange={handleFolderChange}
            labels={resolvedFolderLabels}
            rowClassName={browseStyles?.typography?.folderTreeRowClassName}
          />
        )}
      </div>

      <div className="mb-5 flex flex-col gap-3 mobile:mb-3">
        <div className="flex items-center gap-3 mobile:gap-2">
          <div role="search" className="flex-1">
            <Search
              value={query}
              onChange={handleChange}
              size={ElementSize.Large}
              wrapperClassName={styles.searchField}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              inputRef={searchInputRef}
            />
          </div>
          {isPhone ? (
            <>
              <span className="relative shrink-0">
                <GhostIconButton
                  ref={settingsTriggerRef}
                  size={ElementSize.Large}
                  aria-label={sheetLabels.title}
                  aria-haspopup="dialog"
                  aria-expanded={isSettingsOpen}
                  onClick={() => {
                    onViewModeIntent?.();
                    setIsSettingsOpen(true);
                  }}
                  icon={
                    <IconAdjustmentsHorizontal
                      size={DIAL_ICON_SIZE.LG}
                      stroke={DIAL_KIT_ICON_STROKE}
                      aria-hidden
                    />
                  }
                />
                {isFilterActive && (
                  <span
                    className={mergeClasses(
                      'pointer-events-none absolute inset-e-2.5 top-2.5 size-2 rounded-full',
                      styles.settingsDot,
                    )}
                    aria-hidden
                  />
                )}
              </span>
              <BrowseSettingsSheet
                open={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
                sortOptions={sortOptions}
                sortKey={sortKey}
                onSortChange={onSortChange}
                filters={appliedFilters}
                onFiltersChange={handleFiltersChange}
                filterValues={filterValues}
                labels={sheetLabels}
                typography={browseStyles?.typography}
              />
            </>
          ) : (
            <>
              <div
                ref={desktopControlsRef}
                className="flex shrink-0 items-center gap-3"
              >
                {/* `contents` keeps the toggle a direct flex child; the wrapper
                  only reports intent so the hidden list view can be prepared
                  before the click instead of during page load. */}
                <div
                  className="contents"
                  role="presentation"
                  onPointerEnter={onViewModeIntent}
                  onFocus={onViewModeIntent}
                >
                  <SegmentedControl
                    aria-label={viewToggleLabel}
                    value={viewMode}
                    onChange={onViewModeChange}
                    items={viewModeItems}
                  />
                </div>

                {sortOptions != null && (
                  <SortMenuButton
                    options={sortOptions}
                    value={sortKey}
                    onChange={handleSortChange}
                    label={sortLabel}
                  />
                )}
              </div>
              <Filter
                checked={appliedFilters}
                onChange={handleFiltersChange}
                values={filterValues}
                topicsLabel={filterTopicsLabel}
                triggerLabel={filterLabel}
                clearAllLabel={filterClearAllLabel}
                triggerRef={filterTriggerRef}
                typography={browseStyles?.typography}
              />
            </>
          )}
        </div>
        <AppliedTopicTags
          topics={appliedFilters}
          onChange={handleFiltersChange}
          appliedTopicsLabel={appliedTopicsLabel}
          clearAllLabel={filterClearAllLabel}
          formatRemoveTopicLabel={formatRemoveTopicLabel}
          fallbackFocusRef={isPhone ? settingsTriggerRef : filterTriggerRef}
        />
      </div>
    </div>
  );
};
