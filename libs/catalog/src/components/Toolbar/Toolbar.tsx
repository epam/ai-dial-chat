import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type CSSProperties, FC } from 'react';
import { ToolbarProps } from '../../models/toolbar-props';
import { FilterRow } from './Rows/FilterRow';
import { TitleRow } from './Rows/TitleRow';
import styles from './Toolbar.module.scss';

/** Browse section header: title, view/sort controls, search bar, filter row. */
export const Toolbar: FC<ToolbarProps> = ({
  query,
  onQueryChange,
  isAnyFilterActive,
  onClearFilters,
  searchPlaceholder = 'Search models, tools, agents…',
  styles: browseStyles,
  clearAllLabel = 'Clear all',
  filters,
  onFiltersChange,
  filterValues,
  isMyAppsActive,
  onMyAppsChange,
  filterFromLabel,
  filterMyAppsLabel,
  filterTopicsLabel,
  sortKey,
  onSortChange,
  sortOptions,
  ...innerProps
}) => {
  const cssVars = {
    '--cat-browse-bg': browseStyles?.colors?.background,
    '--cat-browse-title-text': browseStyles?.colors?.titleText,
    '--cat-browse-count-text': browseStyles?.colors?.countText,
    '--cat-browse-icon': browseStyles?.colors?.icon,
    '--cat-browse-divider': browseStyles?.colors?.divider,
    '--cat-browse-clear-all': browseStyles?.colors?.clearAll,
  } as CSSProperties;

  return (
    <section
      className={mergeClasses('flex-shrink-0 px-4', styles.section)}
      style={cssVars}
    >
      {/* Title row with search and sort */}
      <TitleRow
        styles={browseStyles}
        query={query}
        onQueryChange={onQueryChange}
        searchPlaceholder={searchPlaceholder}
        sortKey={sortKey}
        onSortChange={onSortChange}
        sortOptions={sortOptions}
        {...innerProps}
      />

      {/* Filter row */}
      <FilterRow
        filters={filters}
        onFiltersChange={onFiltersChange}
        filterValues={filterValues}
        isMyAppsActive={isMyAppsActive}
        onMyAppsChange={onMyAppsChange}
        isAnyFilterActive={isAnyFilterActive}
        onClearFilters={onClearFilters}
        clearAllLabel={clearAllLabel}
        filterFromLabel={filterFromLabel}
        filterMyAppsLabel={filterMyAppsLabel}
        filterTopicsLabel={filterTopicsLabel}
      />
    </section>
  );
};
