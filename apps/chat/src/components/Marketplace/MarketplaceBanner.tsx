import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, UISelectors } from '@/src/store/selectors';

import {
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import darkMyAppsBanner from '@/public/images/banners/welcome-dark-my-apps.jpg';
import darkBanner from '@/public/images/banners/welcome-dark.jpg';
import lightMyAppsBanner from '@/public/images/banners/welcome-light-my-apps.jpg';
import lightBanner from '@/public/images/banners/welcome-light.jpg';

const getBannerText = (tab: MarketplaceEntitiesTabs) => {
  return {
    title: {
      [MarketplaceTabs.HOME]: 'Welcome to DIAL Marketplace',
      [MarketplaceTabs.MY_WORKSPACE]: 'My workspace',
    },
    subtitle: {
      [MarketplaceTabs.HOME]:
        'Explore our AI offerings with your data and see how they boost your productivity!',
      [MarketplaceTabs.MY_WORKSPACE]: `Here you can manage the ${tab === MarketplaceEntitiesTabs.AGENTS ? ' AI agents' : 'toolsets'} used in your daily work`,
    },
  };
};

const getBannerSrc = (theme: string, tab: MarketplaceTabs) => {
  if (theme === 'dark') {
    return tab === MarketplaceTabs.MY_WORKSPACE
      ? darkMyAppsBanner.src
      : darkBanner.src;
  }

  return tab === MarketplaceTabs.MY_WORKSPACE
    ? lightMyAppsBanner.src
    : lightBanner.src;
};

export const MarketplaceBanner = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const selectedTheme = useAppSelector(UISelectors.selectThemeState);
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);
  const selectedEntitiesTab = useAppSelector(
    MarketplaceSelectors.selectSelectedEntitiesTab,
  );

  const { title, subtitle } = getBannerText(selectedEntitiesTab);

  const bannerStyleVariable = useMemo(() => {
    const fallbackBannerSrc = getBannerSrc(selectedTheme, selectedTab);
    const tabBannerCssVariableName =
      selectedTab === MarketplaceTabs.MY_WORKSPACE
        ? '--my-workspace-banner'
        : '--marketplace-banner';

    const bannerCssVariable = `var(${tabBannerCssVariableName}, url(${fallbackBannerSrc}))`;
    return { backgroundImage: bannerCssVariable };
  }, [selectedTab, selectedTheme]);

  return (
    <div
      className="hidden rounded-md bg-cover bg-center bg-no-repeat py-6 md:block"
      style={bannerStyleVariable}
    >
      <h1 className="text-center text-xl font-semibold">
        {t(title[selectedTab])}
      </h1>
      <p className="mt-2 text-center">{t(subtitle[selectedTab])}</p>
    </div>
  );
};
