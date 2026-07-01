import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DialButtonDropdown,
} from '@epam/ai-dial-ui-kit';
import { IconLayoutGrid, IconLayoutList } from '@tabler/icons-react';
import { FC } from 'react';
import { CatalogSortOption, ToolbarProps } from '../../../models/toolbar-props';
import { CatalogViewMode } from '../../../types/view-mode';
import { ItemHeader } from '../../ItemHeader/ItemHeader';
import { SearchBar } from '../../SearchBar/SearchBar';

interface TitleRowProps {
  totalCount?: number;
  viewMode: CatalogViewMode;
  onViewModeChange: (mode: CatalogViewMode) => void;
  title?: string;
  styles?: ToolbarProps['styles'];
  query: string;
  onQueryChange: (q: string) => void;
  searchPlaceholder?: string;
  sortKey?: string;
  onSortChange?: (key: string) => void;
  sortOptions?: CatalogSortOption[];
}

/** Browse section header: title + view toggle + sort, then search bar below. */
export const TitleRow: FC<TitleRowProps> = ({
  totalCount,
  viewMode,
  onViewModeChange,
  title = 'Browse',
  styles: browseStyles,
  query,
  onQueryChange,
  searchPlaceholder,
  sortKey,
  onSortChange,
  sortOptions,
}) => {
  const titleClassName =
    browseStyles?.typography?.titleClassName ?? 'dial-body-semi-text';
  const countClassName =
    browseStyles?.typography?.countClassName ?? 'dial-tiny-text';

  const activeLabel =
    sortOptions?.find((o) => o.value === sortKey)?.label ?? '';

  return (
    <div className="mb-4 flex flex-col gap-3">
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
                      mode === CatalogViewMode.Grid ? 'Grid view' : 'List view'
                    }
                    aria-pressed={isActive}
                    onClick={() => onViewModeChange(mode)}
                    className={mergeClasses(
                      'flex items-center justify-center rounded-full px-3 py-1.5 transition-colors',
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

              <DialButtonDropdown
                label={activeLabel}
                variant={ButtonVariant.Primary}
                appearance={ButtonAppearance.Ghost}
                items={sortOptions.map((o) => ({
                  key: o.value,
                  label: o.label,
                  onClick: ({ key }: { key: string }) => onSortChange?.(key),
                }))}
              />
            </>
          )}
        </div>
      </div>

      {/* Row 2: full-width search bar */}
      <SearchBar
        value={query}
        onChange={onQueryChange}
        placeholder={searchPlaceholder}
      />
    </div>
  );
};
