import { IconLayoutGrid, IconLayoutList } from '@tabler/icons-react';
import { useCallback } from 'react';

import classNames from 'classnames';

import { MarketplaceActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import { ViewTypes } from '@/src/constants/marketplace';

const views = [
  { view: ViewTypes.CARD, Icon: IconLayoutGrid },
  { view: ViewTypes.TABLE, Icon: IconLayoutList },
];

export const ViewToggler: React.FC = () => {
  const dispatch = useAppDispatch();

  const selectedViewType = useAppSelector(
    MarketplaceSelectors.selectSelectedViewType,
  );

  const handleToggleView = useCallback(
    (viewType: ViewTypes) => {
      dispatch(MarketplaceActions.setSelectedView({ viewType }));
    },
    [dispatch],
  );

  return (
    <div className="flex gap-2">
      {views.map(({ view, Icon }) => (
        <button
          key={view}
          className={classNames(
            'rounded border p-1.5',
            selectedViewType === view
              ? 'border-accent-primary text-accent-primary'
              : 'border-secondary text-secondary',
          )}
          onClick={() => handleToggleView(view)}
        >
          <Icon size={24} />
        </button>
      ))}
    </div>
  );
};
