import {
  ItemHeader,
  mergeClasses,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ButtonDropdown,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  DropdownItem,
  ElementSize,
  GhostIconButton,
  MenuItemMark,
  Search,
  SegmentedControl,
  SegmentedControlItem,
  SelectOption,
} from '@epam/ai-dial-ui-kit';
import {
  IconAdjustmentsHorizontal,
  IconLayoutGrid,
  IconLayoutList,
} from '@tabler/icons-react';
import { FC, ReactNode, Ref, useMemo, useState } from 'react';
import { DEFAULT_BROWSE_SETTINGS_LABELS } from '../../../constants/browse-settings';
import {
  BrowseSettingsSheetLabels,
  ToolbarStyles,
} from '../../../models/toolbar-props';
import { CatalogViewMode } from '../../../types/view-mode';
import { Filter } from '../../Filter/Filter';
import { BrowseSettingsSheet } from '../BrowseSettingsSheet';
import styles from '../Toolbar.module.scss';

interface TitleRowProps {
  totalCount?: number;
  viewMode: CatalogViewMode;
  onViewModeChange: (mode: CatalogViewMode) => void;
  title?: string;
  browseHeaderRenderer?: ReactNode;
  styles?: ToolbarStyles;
  query: string;
  onQueryChange: (q: string) => void;
  searchPlaceholder?: string;
  searchInputRef?: Ref<HTMLInputElement>;
  gridViewLabel?: string;
  listViewLabel?: string;
  viewToggleLabel?: string;
  sortKey?: string;
  sortOptions?: SelectOption[];
  onSortChange?: (sortKey: string) => void;
  sortLabel?: string;
  filters?: Set<string>;
  onFiltersChange?: (filters: Set<string>) => void;
  filterValues?: Set<string>;
  isMyAppsActive?: boolean;
  onMyAppsChange?: (isActive: boolean) => void;
  filterFromLabel?: string;
  filterMyAppsLabel?: string;
  filterTopicsLabel?: string;
  browseSettingsLabels?: Partial<BrowseSettingsSheetLabels>;
}

/* Shared, never mutated: the filter components copy before editing. */
const EMPTY_FILTERS = new Set<string>();

/** Browse section header: title + view toggle + sort, then search + filter row below. */
export const TitleRow: FC<TitleRowProps> = ({
  totalCount,
  viewMode,
  onViewModeChange,
  title = 'Browse',
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
  isMyAppsActive,
  onMyAppsChange,
  filterFromLabel,
  filterMyAppsLabel,
  filterTopicsLabel,
  browseSettingsLabels,
}) => {
  const isMobile = useIsMobile();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isFilterActive = (isMyAppsActive ?? false) || (filters?.size ?? 0) > 0;
  const sheetLabels: BrowseSettingsSheetLabels = {
    ...DEFAULT_BROWSE_SETTINGS_LABELS,
    myApps: filterMyAppsLabel ?? DEFAULT_BROWSE_SETTINGS_LABELS.myApps,
    topics: filterTopicsLabel ?? DEFAULT_BROWSE_SETTINGS_LABELS.topics,
    ...browseSettingsLabels,
  };

  const titleClassName =
    browseStyles?.typography?.titleClassName ?? 'dial-body-semi-text';
  const countClassName =
    browseStyles?.typography?.countClassName ?? 'dial-tiny-semi-text';

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

  /* Falls back to the control's own name so the trigger is never a button with
   * no accessible name, which is what an unrecognised sortKey would produce —
   * the kit's `Button` derives its `aria-label` from `label` and overrides any
   * the caller passes, so the visible label is the only name available. */
  const activeSortLabel =
    sortOptions?.find((option) => option.value === sortKey)?.label ?? sortLabel;

  /*
   * The host passes the values alone; the marking and the click belong here,
   * so the trigger and the menu cannot disagree about which order is applied.
   */
  const sortItems = useMemo<DropdownItem[]>(
    () =>
      (sortOptions ?? []).map((option) => ({
        key: option.value,
        label: option.label,
        mark: MenuItemMark.Check,
        checked: option.value === sortKey,
        onClick: () => onSortChange?.(option.value),
      })),
    [sortOptions, sortKey, onSortChange],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: title | view toggle | divider | sort. Below the desktop
          breakpoint the controls move into the browse-settings sheet, so the
          row holds the title alone. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {browseHeaderRenderer ?? (
          <ItemHeader
            title={title}
            postfix={totalCount}
            titleClassName={titleClassName}
            postfixClassName={countClassName}
            className="shrink-0"
            shouldTruncateTitle={false}
            colors={{
              title: browseStyles?.colors?.titleText,
              count: browseStyles?.colors?.countText,
            }}
          />
        )}

        {!isMobile && (
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <SegmentedControl
              aria-label={viewToggleLabel}
              value={viewMode}
              onChange={onViewModeChange}
              items={viewModeItems}
            />

            {sortOptions != null && sortOptions.length > 0 && (
              <>
                <div
                  className={mergeClasses('h-4 w-px shrink-0', styles.divider)}
                />

                {/* The trigger shows the applied order and the menu marks it
                  with the design's trailing check. */}
                <ButtonDropdown
                  items={sortItems}
                  label={activeSortLabel}
                  variant={ButtonVariant.Primary}
                  appearance={ButtonAppearance.Ghost}
                />
              </>
            )}
          </div>
        )}
      </div>

      <div className="mb-5 flex items-center gap-3 mobile:mb-3 mobile:gap-2">
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
        {isMobile ? (
          <>
            <span className="relative shrink-0">
              <GhostIconButton
                size={ElementSize.Large}
                aria-label={sheetLabels.title}
                aria-haspopup="dialog"
                aria-expanded={isSettingsOpen}
                onClick={() => setIsSettingsOpen(true)}
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
              filters={filters ?? EMPTY_FILTERS}
              onFiltersChange={onFiltersChange ?? (() => undefined)}
              filterValues={filterValues}
              isMyAppsActive={isMyAppsActive}
              onMyAppsChange={onMyAppsChange}
              labels={sheetLabels}
              typography={browseStyles?.typography}
            />
          </>
        ) : (
          <Filter
            checked={filters ?? EMPTY_FILTERS}
            onChange={onFiltersChange ?? (() => undefined)}
            values={filterValues}
            isMyAppsActive={isMyAppsActive}
            onMyAppsChange={onMyAppsChange}
            defaultLabel={filterFromLabel}
            myAppsLabel={filterMyAppsLabel}
            topicsLabel={filterTopicsLabel}
            clearLabel={browseSettingsLabels?.clear}
            applyLabel={browseSettingsLabels?.apply}
            typography={browseStyles?.typography}
          />
        )}
      </div>
    </div>
  );
};
