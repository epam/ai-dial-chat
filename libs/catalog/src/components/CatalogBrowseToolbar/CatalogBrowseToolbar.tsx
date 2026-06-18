import {
  ButtonAppearance,
  ButtonVariant,
  DialButtonDropdown,
  DialIcon,
  DialIconButton,
  DialLinkButton,
  DialSearch,
  DialTabs,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import type { TabModel } from '@epam/ai-dial-ui-kit';
import {
  IconFilter,
  IconLayoutCards,
  IconLayoutList,
  IconX,
} from '@tabler/icons-react';
import { type CSSProperties, FC } from 'react';
import { DEFAULT_SORT_OPTIONS } from '../../constants/catalog-defaults';
import type { CatalogSortOption, TreeNode } from '../../models/CatalogItem';
import { CatalogViewMode } from '../../types/CatalogViewMode';
import { DomainFilter } from '../DomainFilter/DomainFilter';
import { FromFilter } from '../FromFilter/FromFilter';
import { MaturityFilter } from '../MaturityFilter/MaturityFilter';
import { UseCaseFilter } from '../UseCaseFilter/UseCaseFilter';
import styles from './CatalogBrowseToolbar.module.scss';

/** Typography class overrides for `CatalogBrowseToolbar`. */
export interface CatalogBrowseToolbarTypography {
  /** Typography class for the section title. Default: `'dial-h3-text'`. */
  titleClassName?: string;
  /** Typography class for the total count. Default: `'dial-tiny-text'`. */
  countClassName?: string;
}

/** Color overrides for `CatalogBrowseToolbar`, applied via CSS custom properties. */
export interface CatalogBrowseToolbarColors {
  /** Section background color. Fallback: `--bg-layer-1`. */
  background?: string;
  /** Section title text color. Fallback: `--text-primary`. */
  titleText?: string;
  /** Total count text color. Fallback: `--text-secondary`. */
  countText?: string;
  /** Filter icon color. Fallback: `--text-secondary`. */
  icon?: string;
  /** Vertical divider color next to sort dropdown. Fallback: `--stroke-secondary`. */
  divider?: string;
  /** Clear-all button text color. Fallback: `--text-error`. */
  clearAll?: string;
  /** Bottom border color of tabs row. Fallback: `--stroke-secondary`. */
  tabsBorder?: string;
}

/** Grouped style overrides for `CatalogBrowseToolbar`. */
export interface CatalogBrowseToolbarStyles {
  /** Typography class overrides for heading and count. */
  typography?: CatalogBrowseToolbarTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: CatalogBrowseToolbarColors;
}

/** Props for CatalogBrowseToolbar. */
export interface CatalogBrowseToolbarProps {
  /** Total item count shown next to the "Browse" heading. */
  totalCount?: number;
  /** Current display mode. */
  viewMode: CatalogViewMode;
  /** Called when the display mode changes. */
  onViewModeChange: (mode: CatalogViewMode) => void;
  /** Current sort key. */
  sortKey: string;
  /** Called when sort changes. */
  onSortChange: (key: string) => void;
  /** Current search query. */
  query: string;
  /** Called when the query changes. */
  onQueryChange: (q: string) => void;
  /** Checked IDs for the "From" tree filter. */
  fromChecked: Set<string>;
  /** All source IDs (to compute "all selected" state). */
  allFromIds: Set<string>;
  /** Source hierarchy tree for the From filter. */
  fromTree: TreeNode[];
  /** Called when the From filter changes. */
  onFromChange: (checked: Set<string>) => void;
  /** Selected domain values. */
  domainSelected: Set<string>;
  /** Domain filter options. */
  domainOptions: string[];
  /** Called when domain filter changes. */
  onDomainChange: (selected: Set<string>) => void;
  /** Selected use-case values. */
  useCaseSelected: Set<string>;
  /** Use-case filter options. */
  useCaseOptions: string[];
  /** Called when use-case filter changes. */
  onUseCaseChange: (selected: Set<string>) => void;
  /** Selected maturity values. */
  maturitySelected: Set<string>;
  /** Maturity filter options. */
  maturityOptions: string[];
  /** Called when maturity filter changes. */
  onMaturityChange: (selected: Set<string>) => void;
  /** Whether at least one filter is active. */
  isAnyFilterActive: boolean;
  /** Called when "Clear all" is clicked. */
  onClearFilters: () => void;
  /** Tabs for the entity type tabs. */
  tabs: TabModel[];
  /** Currently active tab ID. */
  activeTab: string;
  /** Called when a tab is clicked. */
  onTabChange: (id: string) => void;
  /** Section heading text. Default: 'Browse'. */
  title?: string;
  /** Search input placeholder. Default: 'Search models, tools, agents…'. */
  searchPlaceholder?: string;
  /** Sort dropdown options. Default: DEFAULT_SORT_OPTIONS. */
  sortOptions?: CatalogSortOption[];
  /** Grouped typography and color overrides. */
  styles?: CatalogBrowseToolbarStyles;
  /** Label for the "Clear all" filters button. Default: 'Clear all'. */
  clearAllLabel?: string;
}

/** Browse section header: title, view/sort controls, search bar, filter row, and tabs. */
export const CatalogBrowseToolbar: FC<CatalogBrowseToolbarProps> = ({
  totalCount,
  viewMode,
  onViewModeChange,
  sortKey,
  onSortChange,
  query,
  onQueryChange,
  fromChecked,
  allFromIds,
  fromTree,
  onFromChange,
  domainSelected,
  domainOptions,
  onDomainChange,
  useCaseSelected,
  useCaseOptions,
  onUseCaseChange,
  maturitySelected,
  maturityOptions,
  onMaturityChange,
  isAnyFilterActive,
  onClearFilters,
  tabs,
  activeTab,
  onTabChange,
  title = 'Browse',
  searchPlaceholder = 'Search models, tools, agents…',
  sortOptions = DEFAULT_SORT_OPTIONS,
  styles: browseStyles,
  clearAllLabel = 'Clear all',
}) => {
  const titleClassName =
    browseStyles?.typography?.titleClassName ?? 'dial-h3-text';
  const countClassName =
    browseStyles?.typography?.countClassName ?? 'dial-tiny-text';
  const cssVars = {
    '--cat-browse-bg': browseStyles?.colors?.background,
    '--cat-browse-title-text': browseStyles?.colors?.titleText,
    '--cat-browse-count-text': browseStyles?.colors?.countText,
    '--cat-browse-icon': browseStyles?.colors?.icon,
    '--cat-browse-divider': browseStyles?.colors?.divider,
    '--cat-browse-clear-all': browseStyles?.colors?.clearAll,
    '--cat-browse-tabs-border': browseStyles?.colors?.tabsBorder,
  } as CSSProperties;

  const currentSortLabel =
    sortOptions.find((o) => o.value === sortKey)?.label ?? '';

  return (
    <section
      className={['flex-shrink-0 px-4 pt-4', styles.section].join(' ')}
      style={cssVars}
    >
      {/* Title row */}
      <div className="mb-4 flex items-center">
        <div className="flex flex-1 items-center gap-2">
          <h2 className={['m-0', titleClassName, styles.title].join(' ')}>
            {title}
          </h2>
          {totalCount !== undefined && (
            <span className={[countClassName, styles.count].join(' ')}>
              {totalCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {([CatalogViewMode.Grid, CatalogViewMode.List] as const).map(
            (mode) => (
              <DialIconButton
                key={mode}
                variant={ButtonVariant.Primary}
                appearance={
                  viewMode === mode
                    ? ButtonAppearance.Solid
                    : ButtonAppearance.Ghost
                }
                size={ElementSize.Small}
                icon={
                  mode === CatalogViewMode.Grid ? (
                    <IconLayoutCards size={16} />
                  ) : (
                    <IconLayoutList size={16} />
                  )
                }
                onClick={() => onViewModeChange(mode)}
              />
            ),
          )}
          <div className={['mx-0.5 h-5 w-px', styles.divider].join(' ')} />
          <div className="w-[175px] flex-shrink-0">
            <DialButtonDropdown
              label={currentSortLabel}
              variant={ButtonVariant.Primary}
              appearance={ButtonAppearance.Ghost}
              style={{
                whiteSpace: 'nowrap',
                height: 32,
                width: '100%',
                justifyContent: 'flex-start',
              }}
              items={sortOptions.map((o) => ({
                key: o.value,
                label: o.label,
                onClick: ({ key }: { key: string }) => onSortChange(key),
              }))}
            />
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-3.5">
        <DialSearch
          value={query}
          placeholder={searchPlaceholder}
          onChange={onQueryChange}
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2 pb-4">
        <DialIcon icon={<IconFilter size={20} />} className={styles.icon} />
        <FromFilter
          checked={fromChecked}
          onChange={onFromChange}
          tree={fromTree}
          allIds={allFromIds}
        />
        <DomainFilter
          selected={domainSelected}
          onChange={onDomainChange}
          options={domainOptions}
        />
        <UseCaseFilter
          selected={useCaseSelected}
          onChange={onUseCaseChange}
          options={useCaseOptions}
        />
        <MaturityFilter
          selected={maturitySelected}
          onChange={onMaturityChange}
          options={maturityOptions}
        />
        {isAnyFilterActive && (
          <DialLinkButton
            label={clearAllLabel}
            iconBefore={<IconX size={14} />}
            className={styles.clearAll}
            onClick={onClearFilters}
          />
        )}
      </div>

      {/* Tab bar — [&>div]:justify-center targets DialTabs' inner flex container */}
      {activeTab && (
        <div
          className={['border-b [&>div]:justify-center', styles.tabs].join(' ')}
        >
          <DialTabs tabs={tabs} activeTab={activeTab} onClick={onTabChange} />
        </div>
      )}
    </section>
  );
};
