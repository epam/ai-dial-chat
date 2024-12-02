import { useRouter } from 'next/router';

import { ApiUtils } from '@/src/utils/server/api';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { Feature } from '@epam/ai-dial-shared';
import cssEscape from 'css.escape';

export const Logo = () => {
  const router = useRouter();

  const customLogo = useAppSelector(UISelectors.selectCustomLogo);
  const isCustomLogoFeatureEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CustomLogo),
  );

  const customLogoUrl =
    isCustomLogoFeatureEnabled &&
    customLogo &&
    `/api/${ApiUtils.encodeApiUrl(customLogo)}`;

  const handleLogoClick = () => {
    router.push('/');
  };

  return (
    <span
      onClick={handleLogoClick}
      className="mx-auto min-w-[110px] cursor-pointer bg-contain bg-center bg-no-repeat md:ml-5 lg:bg-left"
      style={{
        backgroundImage: customLogoUrl
          ? `url(${cssEscape(customLogoUrl)})`
          : `var(--app-logo)`,
      }}
    ></span>
  );
};
