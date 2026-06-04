import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { MarketplaceActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { MarketplaceEntitiesTabs } from '@/src/constants/marketplace';

import { TabButton } from '@/src/components/Buttons/TabButton';

const entitiesTabs = [
  { key: MarketplaceEntitiesTabs.AGENTS, label: MarketplaceI18nKeys.Agents },
  {
    key: MarketplaceEntitiesTabs.TOOLSETS,
    label: MarketplaceI18nKeys.Toolsets,
  },
];

export function EntitiesTabsHeader() {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

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
          className="flex-1 text-center md:flex-auto md:text-start"
          dataQA={key.concat('-tab')}
        >
          {t(label)}
        </TabButton>
      ))}
    </div>
  );
}
