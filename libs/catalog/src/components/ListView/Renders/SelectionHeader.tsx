import { Checkbox } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import { useListSelection } from '../selection-context';

/** ag-grid header component for the multi-select column: a select-all checkbox. */
export const SelectionHeader: FC = () => {
  const {
    isAllSelected,
    isSomeSelected,
    hasItems,
    toggleAll,
    selectAllAriaLabel,
  } = useListSelection();

  return (
    <div className="flex size-full items-center">
      <Checkbox
        isSelected={isAllSelected}
        isIndeterminate={isSomeSelected}
        disabled={!hasItems}
        aria-label={selectAllAriaLabel}
        onChange={toggleAll}
      />
    </div>
  );
};
