import { IconLayoutGrid, IconLayoutList } from '@tabler/icons-react';

import classNames from 'classnames';

import { ViewTypes } from '@/src/constants/marketplace';

interface Props {
  onToggle: (viewType: ViewTypes) => void;
  selectedViewType: ViewTypes;
}

export const ViewToggler: React.FC<Props> = ({
  onToggle,
  selectedViewType,
}) => {
  return (
    <div className="flex gap-2">
      <button
        className={classNames(
          'rounded border p-1.5',
          selectedViewType === ViewTypes.CARD
            ? 'border-accent-primary text-accent-primary'
            : 'border-secondary text-secondary',
        )}
        onClick={() => onToggle(ViewTypes.CARD)}
      >
        <IconLayoutGrid size={24} />
      </button>
      <button
        className={classNames(
          'rounded border p-1.5',
          selectedViewType === ViewTypes.TABLE
            ? 'border-accent-primary text-accent-primary'
            : 'border-secondary text-secondary',
        )}
        onClick={() => onToggle(ViewTypes.TABLE)}
      >
        <IconLayoutList size={24} />
      </button>
    </div>
  );
};
