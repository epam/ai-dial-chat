import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type CSSProperties, FC } from 'react';
import { ToolbarProps } from '../../models/toolbar-props';
import { TitleRow } from './Rows/TitleRow';
import styles from './Toolbar.module.scss';

/** Browse section header: title, view/sort controls, search bar, filter row. */
export const Toolbar: FC<ToolbarProps> = ({
  query,
  onQueryChange,
  searchPlaceholder = 'Search models, tools, agents…',
  styles: browseStyles,
  filters,
  onFiltersChange,
  filterValues,
  isMyAppsActive,
  onMyAppsChange,
  filterFromLabel,
  filterMyAppsLabel,
  filterTopicsLabel,
  gridViewLabel,
  listViewLabel,
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
    '--cat-view-toggle-bg': browseStyles?.colors?.viewToggleBackground,
    '--cat-view-toggle-border': browseStyles?.colors?.viewToggleBorder,
    '--cat-view-toggle-active-bg':
      browseStyles?.colors?.viewToggleActiveBackground,
    '--cat-view-toggle-active-text': browseStyles?.colors?.viewToggleActiveText,
    '--cat-view-toggle-text': browseStyles?.colors?.viewToggleText,
    '--cat-view-toggle-text-hover': browseStyles?.colors?.viewToggleTextHover,
  } as CSSProperties;

  return (
    <section
      className={mergeClasses('flex-shrink-0 px-4', styles.section)}
      style={cssVars}
    >
      {/* Title row with search, filter, and sort */}
      <TitleRow
        styles={browseStyles}
        query={query}
        onQueryChange={onQueryChange}
        searchPlaceholder={searchPlaceholder}
        gridViewLabel={gridViewLabel}
        listViewLabel={listViewLabel}
        sortKey={sortKey}
        onSortChange={onSortChange}
        sortOptions={sortOptions}
        filters={filters}
        onFiltersChange={onFiltersChange}
        filterValues={filterValues}
        isMyAppsActive={isMyAppsActive}
        onMyAppsChange={onMyAppsChange}
        filterFromLabel={filterFromLabel}
        filterMyAppsLabel={filterMyAppsLabel}
        filterTopicsLabel={filterTopicsLabel}
        {...innerProps}
      />
    </section>
  );
};
