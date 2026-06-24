import {
  DIAL_ICON_SIZE,
  DialDangerButton,
  DialIcon,
  ElementSize,
  ButtonAppearance,
} from '@epam/ai-dial-ui-kit';
import { IconFilter, IconX } from '@tabler/icons-react';
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

/** Filter row: filter dropdown, active filter indicators, and "Clear all" button. */
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
    <DialIcon
      icon={<IconFilter size={DIAL_ICON_SIZE.MD} />}
      className={styles.icon}
    />

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
      <DialDangerButton
        label={clearAllLabel}
        iconBefore={<IconX size={DIAL_ICON_SIZE.SM} />}
        className={styles.clearAll}
        onClick={onClearFilters}
        size={ElementSize.Small}
        appearance={ButtonAppearance.Ghost}
      />
    )}
  </div>
);
