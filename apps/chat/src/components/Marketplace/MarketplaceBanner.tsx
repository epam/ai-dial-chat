import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { MarketplaceTabs } from '@/src/constants/marketplace';

import darkMyAppsBanner from '@/public/images/banners/welcome-dark-my-apps.jpg';
import darkBanner from '@/public/images/banners/welcome-dark.jpg';
import lightMyAppsBanner from '@/public/images/banners/welcome-light-my-apps.jpg';
import lightBanner from '@/public/images/banners/welcome-light.jpg';

const bannerText = {
  title: {
    [MarketplaceTabs.HOME]: 'Welcome to DIAL Marketplace',
    [MarketplaceTabs.MY_APPLICATIONS]: 'My workspace',
  },
  subtitle: {
    [MarketplaceTabs.HOME]:
      'Explore our AI offerings with your data and see how they boost your productivity!',
    [MarketplaceTabs.MY_APPLICATIONS]:
      'Here you can manage the AI agents used in your daily work',
  },
};

const getBannerSrc = (theme: string, tab: MarketplaceTabs) => {
  if (theme === 'dark') {
    return tab === MarketplaceTabs.MY_APPLICATIONS
      ? darkMyAppsBanner.src
      : darkBanner.src;
  }

  return tab === MarketplaceTabs.MY_APPLICATIONS
    ? lightMyAppsBanner.src
    : lightBanner.src;
};

export const MarketplaceBanner = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const selectedTheme = useAppSelector(UISelectors.selectThemeState);
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  return (
    <div
      className="hidden rounded-md bg-cover bg-center bg-no-repeat py-6 md:block"
      style={{
        backgroundImage: `url(${getBannerSrc(selectedTheme, selectedTab)})`,
      }}
    >
      <h1 className="text-center text-xl font-semibold">
        {t(bannerText.title[selectedTab])}
      </h1>
      <p className="mt-2 text-center">{t(bannerText.subtitle[selectedTab])}</p>
    </div>
  );
};
