import { ItemHeader, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ButtonDropdown,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  DropdownItem,
  ElementSize,
  Search,
  SegmentedControl,
  SegmentedControlItem,
} from '@epam/ai-dial-ui-kit';
import { IconLayoutGrid, IconLayoutList } from '@tabler/icons-react';
import { FC, ReactNode, useMemo } from 'react';
import { ToolbarStyles } from '../../../models/toolbar-props';
import { CatalogViewMode } from '../../../types/view-mode';
import { Filter } from '../../Filter/Filter';
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
  gridViewLabel?: string;
  listViewLabel?: string;
  viewToggleLabel?: string;
  sortKey?: string;
  sortOptions?: DropdownItem[];
  filters?: Set<string>;
  onFiltersChange?: (filters: Set<string>) => void;
  filterValues?: Set<string>;
  isMyAppsActive?: boolean;
  onMyAppsChange?: (isActive: boolean) => void;
  filterFromLabel?: string;
  filterMyAppsLabel?: string;
  filterTopicsLabel?: string;
}

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
  gridViewLabel = 'Grid view',
  listViewLabel = 'List view',
  viewToggleLabel = 'View mode',
  sortKey,
  sortOptions,
  filters,
  onFiltersChange,
  filterValues,
  isMyAppsActive,
  onMyAppsChange,
  filterFromLabel,
  filterMyAppsLabel,
  filterTopicsLabel,
}) => {
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

  const activeLabel = sortOptions?.find((o) => o.key === sortKey)?.label ?? '';

  const handleChange = (nextValue?: string) => {
    onQueryChange(nextValue ?? '');
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: title | view toggle | divider | sort */}
      <div className="flex items-center gap-2">
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

        <div className="ms-auto flex items-center gap-2">
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

              <ButtonDropdown
                label={activeLabel}
                variant={ButtonVariant.Primary}
                appearance={ButtonAppearance.Ghost}
                items={sortOptions}
              />
            </>
          )}
        </div>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <div role="search" className="flex-1">
          <Search
            value={query}
            onChange={handleChange}
            size={ElementSize.Large}
            wrapperClassName="dial-kit-input-large"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>
        <Filter
          checked={filters ?? new Set()}
          onChange={onFiltersChange ?? (() => undefined)}
          values={filterValues}
          isMyAppsActive={isMyAppsActive}
          onMyAppsChange={onMyAppsChange}
          defaultLabel={filterFromLabel}
          myAppsLabel={filterMyAppsLabel}
          topicsLabel={filterTopicsLabel}
          typography={browseStyles?.typography}
        />
      </div>
    </div>
  );
};
