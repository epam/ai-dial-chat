import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  BottomSheet,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostButton,
  MenuItem,
  MenuItemMark,
  PrimaryButton,
  SelectOption,
} from '@epam/ai-dial-ui-kit';
import {
  IconChevronRight,
  IconLayoutGrid,
  IconLayoutList,
} from '@tabler/icons-react';
import { FC, useMemo, useState } from 'react';
import {
  BrowseSettingsSheetLabels,
  ToolbarTypography,
} from '../../models/toolbar-props';
import { BrowseSettingsPage } from '../../types/browse-settings';
import { CatalogViewMode } from '../../types/view-mode';
import { toggleTopic } from '../../utils/catalog-filter';
import filterStyles from '../Filter/Filter.module.scss';

/** Props for the mobile browse-settings sheet. */
export interface BrowseSettingsSheetProps {
  /** Whether the sheet is shown. */
  open: boolean;
  /** Called when the sheet closes. */
  onClose: () => void;
  /** Current display mode. */
  viewMode: CatalogViewMode;
  /** Called when the display mode changes. */
  onViewModeChange: (mode: CatalogViewMode) => void;
  /** Values the sort page lists; the row is hidden when empty. */
  sortOptions?: SelectOption[];
  /** Currently active sort key. */
  sortKey?: string;
  /** Called with the picked option's value. */
  onSortChange?: (sortKey: string) => void;
  /** Applied topic filters. */
  filters: Set<string>;
  /** Called with the topics on Apply or Clear. */
  onFiltersChange: (filters: Set<string>) => void;
  /** All available topics. */
  filterValues?: Set<string>;
  /** Whether the "My" filter is applied. */
  isMyAppsActive?: boolean;
  /** Called with the "My" state on Apply or Clear. */
  onMyAppsChange?: (isActive: boolean) => void;
  /** Sheet text. */
  labels: BrowseSettingsSheetLabels;
  /** Typography overrides shared with the desktop filter. */
  typography?: ToolbarTypography;
}

const chevron = (
  <IconChevronRight
    size={DIAL_ICON_SIZE.SM}
    stroke={DIAL_KIT_ICON_STROKE}
    className="rtl:scale-x-[-1]"
    aria-hidden
  />
);

/** Mobile bottom sheet that drills into View, Sorting and Filtering pages for the catalog browse section. */
/* View and sort apply on pick; filters stay buffered until Apply, like the
   desktop `Filter` dropdown. */
export const BrowseSettingsSheet: FC<BrowseSettingsSheetProps> = ({
  open,
  onClose,
  viewMode,
  onViewModeChange,
  sortOptions,
  sortKey,
  onSortChange,
  filters,
  onFiltersChange,
  filterValues,
  isMyAppsActive,
  onMyAppsChange,
  labels,
  typography,
}) => {
  const [page, setPage] = useState(BrowseSettingsPage.Root);
  const [pendingChecked, setPendingChecked] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingMyApps, setPendingMyApps] = useState(false);

  const topics = useMemo(
    () => (filterValues != null ? [...filterValues].sort() : []),
    [filterValues],
  );
  const hasSort = sortOptions != null && sortOptions.length > 0;
  const appliedFilterCount = filters.size + (isMyAppsActive ? 1 : 0);

  const handleClose = () => {
    setPage(BrowseSettingsPage.Root);
    onClose();
  };

  const openFiltering = () => {
    setPendingChecked(new Set(filters));
    setPendingMyApps(isMyAppsActive ?? false);
    setPage(BrowseSettingsPage.Filtering);
  };

  const handleApply = () => {
    onFiltersChange(pendingChecked);
    onMyAppsChange?.(pendingMyApps);
    handleClose();
  };

  const handleClear = () => {
    onFiltersChange(new Set());
    onMyAppsChange?.(false);
    handleClose();
  };

  const viewOptions = [
    {
      value: CatalogViewMode.Grid,
      label: labels.gridView,
      Icon: IconLayoutGrid,
    },
    {
      value: CatalogViewMode.Cards,
      label: labels.listView,
      Icon: IconLayoutList,
    },
  ];

  const titles: Record<BrowseSettingsPage, string> = {
    [BrowseSettingsPage.Root]: labels.title,
    [BrowseSettingsPage.View]: labels.view,
    [BrowseSettingsPage.Sorting]: labels.sorting,
    [BrowseSettingsPage.Filtering]: labels.filtering,
  };

  const isFiltering = page === BrowseSettingsPage.Filtering;

  return (
    <BottomSheet
      open={open}
      title={titles[page]}
      onBack={
        page === BrowseSettingsPage.Root
          ? undefined
          : () => setPage(BrowseSettingsPage.Root)
      }
      backAriaLabel={labels.back}
      closeAriaLabel={labels.close}
      onClose={handleClose}
      /* The filter page keeps its Clear/Apply footer pinned while the topics
         scroll, so the body becomes a column with one scrolling child. */
      bodyClassName={mergeClasses(isFiltering && 'flex flex-col')}
    >
      {page === BrowseSettingsPage.Root && (
        <div role="menu" aria-label={labels.title} className="p-2">
          <MenuItem
            role="menuitem"
            aria-haspopup="menu"
            label={labels.view}
            trailing={chevron}
            onClick={() => setPage(BrowseSettingsPage.View)}
          />
          {hasSort && (
            <MenuItem
              role="menuitem"
              aria-haspopup="menu"
              label={labels.sorting}
              trailing={chevron}
              onClick={() => setPage(BrowseSettingsPage.Sorting)}
            />
          )}
          <MenuItem
            role="menuitem"
            aria-haspopup="menu"
            label={labels.filtering}
            description={
              appliedFilterCount > 0
                ? labels.formatFilterCount(
                    appliedFilterCount,
                    topics.length + 1,
                  )
                : undefined
            }
            trailing={chevron}
            onClick={openFiltering}
          />
        </div>
      )}

      {page === BrowseSettingsPage.View && (
        <div role="menu" aria-label={labels.view} className="p-2">
          {viewOptions.map(({ value, label, Icon }) => (
            <MenuItem
              key={value}
              role="menuitemradio"
              aria-checked={viewMode === value}
              mark={MenuItemMark.Check}
              selected={viewMode === value}
              label={label}
              icon={
                <Icon
                  size={DIAL_ICON_SIZE.SM}
                  stroke={DIAL_KIT_ICON_STROKE}
                  aria-hidden
                />
              }
              onClick={() => {
                onViewModeChange(value);
                handleClose();
              }}
            />
          ))}
        </div>
      )}

      {page === BrowseSettingsPage.Sorting && hasSort && (
        <div role="menu" aria-label={labels.sorting} className="p-2">
          {sortOptions.map((option) => (
            <MenuItem
              key={option.value}
              role="menuitemradio"
              aria-checked={option.value === sortKey}
              mark={MenuItemMark.Check}
              selected={option.value === sortKey}
              label={option.label}
              onClick={() => {
                onSortChange?.(option.value);
                handleClose();
              }}
            />
          ))}
        </div>
      )}

      {isFiltering && (
        <>
          <div
            role="menu"
            aria-label={labels.filtering}
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2"
          >
            <MenuItem
              role="menuitemcheckbox"
              aria-checked={pendingMyApps}
              mark={MenuItemMark.Checkbox}
              selected={pendingMyApps}
              label={labels.myApps}
              labelClassName={filterStyles.rowLabel}
              className="shrink-0"
              onClick={() => setPendingMyApps(!pendingMyApps)}
            />
            {topics.length > 0 && (
              <>
                <div
                  role="separator"
                  className={mergeClasses('my-1 h-px', filterStyles.divider)}
                  aria-hidden
                />
                <div
                  className={mergeClasses(
                    'px-[10px] pt-[10px] pb-1',
                    typography?.filterSectionLabelClassName ??
                      'dial-tiny-lead-semi-text',
                    filterStyles.sectionLabel,
                  )}
                  aria-hidden
                >
                  {labels.topics}
                </div>
                {topics.map((topic) => {
                  const isChecked = pendingChecked.has(topic);
                  return (
                    <MenuItem
                      key={topic}
                      role="menuitemcheckbox"
                      aria-checked={isChecked}
                      mark={MenuItemMark.Checkbox}
                      selected={isChecked}
                      label={topic}
                      labelClassName={filterStyles.rowLabel}
                      className="shrink-0"
                      onClick={() =>
                        setPendingChecked(toggleTopic(topic, pendingChecked))
                      }
                    />
                  );
                })}
              </>
            )}
          </div>
          <div
            className={mergeClasses(
              'flex shrink-0 items-center gap-3 px-4 py-3',
              filterStyles.footer,
            )}
          >
            <GhostButton
              label={labels.clear}
              className="flex-1"
              onClick={handleClear}
            />
            <PrimaryButton
              label={labels.apply}
              className="flex-1"
              onClick={handleApply}
            />
          </div>
        </>
      )}
    </BottomSheet>
  );
};
