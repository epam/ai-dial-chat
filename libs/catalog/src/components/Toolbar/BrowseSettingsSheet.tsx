import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  BottomSheet,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  LinkButton,
  MenuItem,
  MenuItemMark,
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
  /** Called with the topics on every toggle and on "Clear all". */
  onFiltersChange: (filters: Set<string>) => void;
  /** All available topics. */
  filterValues?: Set<string>;
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
/* View and sort apply on pick and close the sheet; topics apply on toggle and
   keep the Filtering page open, like the desktop `Filter` dropdown. */
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
  labels,
  typography,
}) => {
  const [page, setPage] = useState(BrowseSettingsPage.Root);

  const topics = useMemo(
    () => (filterValues != null ? [...filterValues].sort() : []),
    [filterValues],
  );
  const hasSort = sortOptions != null && sortOptions.length > 0;
  const appliedFilterCount = filters.size;

  const handleClose = () => {
    setPage(BrowseSettingsPage.Root);
    onClose();
  };

  const handleClearAll = () => onFiltersChange(new Set());

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
      /* The filter page keeps its "Clear all" header pinned while the topics
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
                ? labels.formatFilterCount(appliedFilterCount, topics.length)
                : undefined
            }
            trailing={chevron}
            onClick={() => setPage(BrowseSettingsPage.Filtering)}
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
          <div className="flex shrink-0 items-center gap-2 px-[18px] pt-3 pb-1">
            <span
              className={mergeClasses(
                typography?.filterSectionLabelClassName ??
                  'dial-tiny-lead-semi-text',
                filterStyles.sectionLabel,
              )}
              aria-hidden
            >
              {labels.topics}
            </span>
            <LinkButton
              label={labels.clearAll}
              className="ms-auto"
              disabled={filters.size === 0}
              onClick={handleClearAll}
            />
          </div>
          <div
            role="menu"
            aria-label={labels.filtering}
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2"
          >
            {topics.map((topic) => {
              const isChecked = filters.has(topic);
              return (
                <MenuItem
                  key={topic}
                  role="menuitemcheckbox"
                  aria-checked={isChecked}
                  mark={MenuItemMark.Checkbox}
                  selected={isChecked}
                  label={topic}
                  labelClassName={mergeClasses(
                    filterStyles.rowLabel,
                    typography?.filterButtonClassName,
                  )}
                  className="shrink-0"
                  onClick={() => onFiltersChange(toggleTopic(topic, filters))}
                />
              );
            })}
          </div>
        </>
      )}
    </BottomSheet>
  );
};
