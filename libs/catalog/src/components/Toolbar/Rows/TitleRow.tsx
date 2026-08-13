import { ItemHeader, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ButtonDropdown,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DropdownItem,
  Search,
} from '@epam/ai-dial-ui-kit';
import { IconLayoutGrid, IconLayoutList } from '@tabler/icons-react';
import { FC } from 'react';
import { ToolbarStyles } from '../../../models/toolbar-props';
import { CatalogViewMode } from '../../../types/view-mode';
import { Filter } from '../../Filter/Filter';
import styles from '../Toolbar.module.scss';

interface TitleRowProps {
  totalCount?: number;
  viewMode: CatalogViewMode;
  onViewModeChange: (mode: CatalogViewMode) => void;
  title?: string;
  styles?: ToolbarStyles;
  query: string;
  onQueryChange: (q: string) => void;
  searchPlaceholder?: string;
  gridViewLabel?: string;
  listViewLabel?: string;
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
  styles: browseStyles,
  query,
  onQueryChange,
  searchPlaceholder,
  gridViewLabel = 'Grid view',
  listViewLabel = 'List view',
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

  const activeLabel = sortOptions?.find((o) => o.key === sortKey)?.label ?? '';

  const handleChange = (nextValue?: string) => {
    onQueryChange(nextValue ?? '');
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: title | view toggle | divider | sort */}
      <div className="flex items-center gap-2">
        <ItemHeader
          title={title}
          postfix={totalCount}
          titleClassName={titleClassName}
          postfixClassName={countClassName}
          className="shrink-0"
          colors={{
            title: browseStyles?.colors?.titleText,
            count: browseStyles?.colors?.countText,
          }}
        />

        <div className="ms-auto flex items-center gap-2">
          {/* Segmented view toggle */}
          <div
            className={mergeClasses(
              'flex items-center rounded-full border p-[3px]',
              styles.viewToggleWrapper,
            )}
          >
            {([CatalogViewMode.Grid, CatalogViewMode.List] as const).map(
              (mode) => {
                const isActive = viewMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-label={
                      mode === CatalogViewMode.Grid
                        ? gridViewLabel
                        : listViewLabel
                    }
                    aria-pressed={isActive}
                    onClick={() => onViewModeChange(mode)}
                    className={mergeClasses(
                      'flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 py-1.5 transition-colors desktop:min-h-8 desktop:min-w-10',
                      isActive
                        ? mergeClasses('shadow-sm', styles.viewToggleActive)
                        : styles.viewToggleInactive,
                    )}
                  >
                    {mode === CatalogViewMode.Grid ? (
                      <IconLayoutGrid size={DIAL_ICON_SIZE.SM} />
                    ) : (
                      <IconLayoutList size={DIAL_ICON_SIZE.SM} />
                    )}
                  </button>
                );
              },
            )}
          </div>

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
