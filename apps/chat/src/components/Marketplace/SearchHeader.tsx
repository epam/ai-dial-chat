import { IconSearch } from '@tabler/icons-react';
import { ChangeEvent } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { MarketplaceActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, SettingsSelectors } from '@/src/store/selectors';

import {
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { AddAppButton } from './AddAppButton';
import { AddToolsButton } from './AddToolsButton';
import { ViewToggler } from './ViewToggler';

import { Feature } from '@epam/ai-dial-shared';

export const SearchHeader = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const selectedEntitiesTab = useAppSelector(
    MarketplaceSelectors.selectSelectedEntitiesTab,
  );

  const isAgentsTab = selectedEntitiesTab === MarketplaceEntitiesTabs.AGENTS;

  const isCustomApplicationsEnabled = enabledFeatures.has(
    Feature.CustomApplications,
  );
  const isToolsetsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Toolsets),
  );

  const searchTerm = useAppSelector(MarketplaceSelectors.selectSearchTerm);
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const onSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    dispatch(MarketplaceActions.setSearchTerm(e.target.value));
  };

  return (
    <div className="flex w-full gap-2 sm:justify-end md:w-auto">
      <div className="relative flex h-[38px] grow sm:w-[315px] md:w-[275px] lg:w-[500px]">
        <IconSearch
          className="absolute left-3 top-1/2 -translate-y-1/2"
          size={18}
        />
        <input
          name="titleInput"
          placeholder={t('Search')}
          type="text"
          value={searchTerm}
          onChange={onSearchChange}
          className="w-0 grow rounded border border-primary bg-transparent py-2.5 pl-[38px] pr-3 leading-4 outline-none placeholder:text-secondary focus-visible:border-accent-primary"
        />
      </div>
      {enabledFeatures.has(Feature.MarketplaceTableView) && <ViewToggler />}
      {selectedTab === MarketplaceTabs.MY_WORKSPACE &&
        isCustomApplicationsEnabled &&
        isAgentsTab && <AddAppButton />}
      {selectedTab === MarketplaceTabs.MY_WORKSPACE &&
        isToolsetsEnabled &&
        !isAgentsTab && <AddToolsButton />}
    </div>
  );
};
