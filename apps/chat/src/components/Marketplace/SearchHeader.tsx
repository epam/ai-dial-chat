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
import { DialSearch } from '@epam/ai-dial-ui-kit';

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

  const onSearchChange = (value: string) => {
    dispatch(MarketplaceActions.setSearchTerm(value));
  };

  return (
    <div className="flex w-full grow items-center gap-2 sm:justify-end md:w-auto">
      <DialSearch
        wrapperClassName="lg:max-w-[500px]"
        containerClassName="w-full lg:max-w-[500px]"
        placeholder={t('Search')}
        value={searchTerm}
        onChange={onSearchChange}
      />

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
