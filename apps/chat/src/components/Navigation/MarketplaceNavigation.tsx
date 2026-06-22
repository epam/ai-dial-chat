import { IconHomeRibbon, IconLayoutGrid } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { MarketplaceActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import { SideBarI18nKeys } from '@/src/constants/i18n';
import { MarketplaceTabs } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { withRenderWhenFeature } from '@/src/components/Common/RenderWhen';

import { NavigationButton } from './NavigationButton';

import { Feature } from '@epam/ai-dial-shared';

const view = withRenderWhenFeature(Feature.Marketplace)(() => {
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
        tooltip={t(SideBarI18nKeys.DIALMarketplace)}
        Icon={IconLayoutGrid}
        selected={isMarketplace && currentTab === MarketplaceTabs.HOME}
        dataQa="marketplace-home-page"
        caption={t(SideBarI18nKeys.Apps)}
      />
      <NavigationButton
        onClick={handleMyAppsClick}
        tooltip={t(SideBarI18nKeys.MyWorkspace)}
        Icon={IconHomeRibbon}
        selected={isMarketplace && currentTab === MarketplaceTabs.MY_WORKSPACE}
        dataQa="my-workspace"
        caption={t(SideBarI18nKeys.Workspace)}
      />
    </>
  );
});

export const MarketplaceNavigation = view;
