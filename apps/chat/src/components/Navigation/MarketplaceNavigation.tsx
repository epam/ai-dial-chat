import { IconHomeRibbon, IconLayoutGrid } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceActions } from '@/src/store/marketplace/marketplace.reducers';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.selectors';

import { MarketplaceTabs } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { withRenderWhenFeature } from '@/src/components/Common/RenderWhen';

import { NavigationButton } from './NavigationButton';

import { Feature } from '@epam/ai-dial-shared';

const MarketplaceNavigationView = () => {
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const router = useRouter();

  const selectedMarketplaceTab = useAppSelector(
    MarketplaceSelectors.selectSelectedTab,
  );

  const isMarketplace = router.route === Routes.Marketplace;

  const currentTab = useMemo(() => {
    return (router.query?.tab as MarketplaceTabs) ?? selectedMarketplaceTab;
  }, [router.query, selectedMarketplaceTab]);

  const handleChangeTab = useCallback(
    (tab: MarketplaceTabs) => {
      if (!isMarketplace) {
        router.push({
          pathname: Routes.Marketplace,
          query: { tab },
        });
      } else {
        dispatch(MarketplaceActions.setSelectedTab(tab));
      }
    },
    [dispatch, isMarketplace, router],
  );

  const handleHomeClick = useCallback(
    () => handleChangeTab(MarketplaceTabs.HOME),
    [handleChangeTab],
  );

  const handleMyAppsClick = useCallback(
    () => handleChangeTab(MarketplaceTabs.MY_WORKSPACE),
    [handleChangeTab],
  );

  return (
    <>
      <NavigationButton
        onClick={handleHomeClick}
        tooltip={t('DIAL Marketplace')}
        Icon={IconLayoutGrid}
        selected={isMarketplace && currentTab === MarketplaceTabs.HOME}
        dataQa="marketplace-home-page"
        caption={t('Apps')}
      />
      <NavigationButton
        onClick={handleMyAppsClick}
        tooltip={t('My workspace')}
        Icon={IconHomeRibbon}
        selected={isMarketplace && currentTab === MarketplaceTabs.MY_WORKSPACE}
        dataQa="my-workspace"
        caption={t('Workspace')}
      />
    </>
  );
};

export const MarketplaceNavigation = withRenderWhenFeature(Feature.Marketplace)(
  MarketplaceNavigationView,
);
