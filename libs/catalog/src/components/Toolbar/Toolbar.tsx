import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { SearchBar } from '@epam/ai-dial-kit';
import { type CSSProperties, FC } from 'react';
import { ToolbarProps } from '../../models/toolbar-props';
import { SearchBar } from '../SearchBar/SearchBar';
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
      {/* Title row */}
      <TitleRow styles={browseStyles} {...innerProps} />

      {/* Search bar */}
      <div className="mb-4">
        <SearchBar
          value={query}
          onChange={onQueryChange}
          placeholder={searchPlaceholder}
        />
      </div>

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
