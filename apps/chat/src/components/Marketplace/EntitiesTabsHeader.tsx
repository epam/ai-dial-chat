import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { MarketplaceActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import { MarketplaceEntitiesTabs } from '@/src/constants/marketplace';

import { TabButton } from '@/src/components/Buttons/TabButton';

const entitiesTabs = [
  { key: MarketplaceEntitiesTabs.AGENTS, label: 'Agents' },
  { key: MarketplaceEntitiesTabs.TOOLSETS, label: 'Toolsets' },
];

export function EntitiesTabsHeader() {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Marketplace);

  const selectedEntitiesTab = useAppSelector(
    MarketplaceSelectors.selectSelectedEntitiesTab,
  );

  const handleSelectTab = useCallback(
    (tabId: MarketplaceEntitiesTabs) => {
      dispatch(MarketplaceActions.setSelectedEntitiesTab(tabId));
    },
    [dispatch],
  );

  return (
    <div className="flex w-full gap-3 md:w-auto">
      {entitiesTabs.map(({ label, key }) => (
        <TabButton
          key={key}
          tabKey={key}
          selected={selectedEntitiesTab === key}
          onClick={handleSelectTab}
          className="flex-1 text-center md:flex-auto md:text-left"
        >
          {t(label)}
        </TabButton>
      ))}
    </div>
  );
}
