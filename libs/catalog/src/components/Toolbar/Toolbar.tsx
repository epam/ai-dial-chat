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
  viewToggleLabel,
  sortKey,
  sortOptions,
  ...innerProps
}) => {
  const cssVars = {
    '--cat-browse-divider': browseStyles?.colors?.divider,
  } as CSSProperties;

  return (
    <section
      className={mergeClasses('flex-shrink-0 px-4', styles.section)}
      style={cssVars}
    >
      <TitleRow
        styles={browseStyles}
        query={query}
        onQueryChange={onQueryChange}
        searchPlaceholder={searchPlaceholder}
        gridViewLabel={gridViewLabel}
        listViewLabel={listViewLabel}
        viewToggleLabel={viewToggleLabel}
        sortKey={sortKey}
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
