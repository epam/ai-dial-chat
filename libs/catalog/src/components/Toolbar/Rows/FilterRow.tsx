import { GhostButton } from '@epam/ai-dial-kit';
import { FC } from 'react';
import { Filter } from '../../Filter/Filter';
import styles from '../Toolbar.module.scss';

interface FilterRowProps {
  filters?: Set<string>;
  onFiltersChange?: (filters: Set<string>) => void;
  filterValues?: Set<string>;
  isMyAppsActive?: boolean;
  onMyAppsChange?: (isActive: boolean) => void;
  isAnyFilterActive: boolean;
  onClearFilters: () => void;
  clearAllLabel?: string;
  filterFromLabel?: string;
  filterMyAppsLabel?: string;
  filterTopicsLabel?: string;
}

/** Filter row: filter dropdown chip and conditional "Clear all" link. */
export const FilterRow: FC<FilterRowProps> = ({
  filters = new Set(),
  onFiltersChange,
  filterValues,
  isMyAppsActive,
  onMyAppsChange,
  isAnyFilterActive,
  onClearFilters,
  clearAllLabel = 'Clear all',
  filterFromLabel,
  filterMyAppsLabel,
  filterTopicsLabel,
}) => (
  <div className="flex flex-wrap items-center gap-2 pb-4">
    <Filter
      checked={filters}
      onChange={onFiltersChange ?? (() => undefined)}
      values={filterValues}
      isMyAppsActive={isMyAppsActive}
      onMyAppsChange={onMyAppsChange}
      defaultLabel={filterFromLabel}
      myAppsLabel={filterMyAppsLabel}
      topicsLabel={filterTopicsLabel}
    />

    {isAnyFilterActive && (
      <GhostButton
        label={clearAllLabel}
        className={styles.clearAll}
        onClick={onClearFilters}
      />
    )}
  </div>
);
