import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialSearch } from '@epam/ai-dial-ui-kit';
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
      className={mergeClasses('flex-shrink-0 px-4 pt-4', styles.section)}
      style={cssVars}
    >
      {/* Title row */}
      <TitleRow styles={browseStyles} {...innerProps} />

      {/* Search bar */}
      <div className="mb-4">
        <DialSearch
          value={query}
          placeholder={searchPlaceholder}
          onChange={onQueryChange}
        />
      </div>

      {/* Filter row */}
      <FilterRow
        isAnyFilterActive={isAnyFilterActive}
        onClearFilters={onClearFilters}
        clearAllLabel={clearAllLabel}
      />
    </section>
  );
};
