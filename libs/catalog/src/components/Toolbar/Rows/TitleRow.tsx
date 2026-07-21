import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { GhostButton } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE, DialDropdown } from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconChevronDown,
  IconLayoutGrid,
  IconLayoutList,
} from '@tabler/icons-react';
import { FC } from 'react';
import {
  CatalogSortOption,
  ToolbarStyles,
} from '../../../models/toolbar-props';
import { CatalogViewMode } from '../../../types/view-mode';
import { Filter } from '../../Filter/Filter';
import { ItemHeader } from '../../ItemHeader/ItemHeader';
import { SearchBar } from '../../SearchBar/SearchBar';

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
  onSortChange?: (key: string) => void;
  sortOptions?: CatalogSortOption[];
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
  onSortChange,
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

  const activeLabel =
    sortOptions?.find((o) => o.value === sortKey)?.label ?? '';

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
        />

        <div className="ms-auto flex items-center gap-2">
          {/* Segmented view toggle */}
          <div
            className="flex items-center rounded-full border p-[3px]"
            style={{
              background: 'var(--bg-layer-2, #EEEEF0)',
              borderColor: 'var(--stroke-tertiary, #e0e6f0)',
            }}
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
                        ? 'bg-layer-0 text-accent-primary shadow-sm'
                        : 'text-secondary hover:text-primary',
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
              {/* Vertical divider */}
              <div
                className="h-4 w-px shrink-0"
                style={{ background: 'var(--stroke-secondary, #d1dbea)' }}
              />

              <DialDropdown
                matchReferenceWidth={false}
                placement="bottom-end"
                listClassName="cp-dropdown-overlay"
                items={sortOptions.map((o) => ({
                  key: o.value,
                  label: (
                    <span className="flex w-full items-center justify-between gap-2">
                      {o.label}
                      {o.value === sortKey && (
                        <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden />
                      )}
                    </span>
                  ),
                  onClick: () => onSortChange?.(o.value),
                }))}
              >
                <GhostButton
                  label={activeLabel}
                  iconAfter={
                    <IconChevronDown size={DIAL_ICON_SIZE.SM} aria-hidden />
                  }
                />
              </DialDropdown>
            </>
          )}
        </div>
      </div>

      {/* Row 2: search field + from filter */}
      <div className="mb-5 flex items-center gap-3">
        <SearchBar
          value={query}
          onChange={onQueryChange}
          placeholder={searchPlaceholder}
          className="flex-1"
        />
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
