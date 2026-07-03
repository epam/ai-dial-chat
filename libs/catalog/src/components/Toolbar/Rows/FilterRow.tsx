import { GhostButton } from '@epam/ai-dial-kit';
import { FC } from 'react';
import styles from '../Toolbar.module.scss';

interface FilterRowProps {
  isAnyFilterActive: boolean;
  onClearFilters: () => void;
  clearAllLabel?: string;
}

/** Conditional "Clear all" row — rendered only when at least one filter is active. */
export const FilterRow: FC<FilterRowProps> = ({
  isAnyFilterActive,
  onClearFilters,
  clearAllLabel = 'Clear all',
}) => {
  if (!isAnyFilterActive) return null;
  return (
    <div className="flex items-center gap-2 pb-4">
      <GhostButton
        label={clearAllLabel}
        className={styles.clearAll}
        onClick={onClearFilters}
      />
    </div>
  );
};
