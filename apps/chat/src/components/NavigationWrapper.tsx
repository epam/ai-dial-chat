import { ReactNode } from 'react';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { Routes } from '@/src/constants/routes';

import { Chatbar } from '@/src/components/Chatbar/Chatbar';
import { MarketplaceFilterbar } from '@/src/components/Marketplace/MarketplaceFilterbar';
import { Promptbar } from '@/src/components/Promptbar';
import { Widgetbar } from '@/src/components/Widgetbar';

import { Feature } from '@epam/ai-dial-shared';

const Navigation = dynamic(
  () => import('./Common/Navigation').then((mod) => mod.Navigation),
  { ssr: false },
);

interface NavigationWrapperProps {
  children: ReactNode;
}

export const NavigationWrapper = ({ children }: NavigationWrapperProps) => {
  const router = useRouter();

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const isAppsEditorRoute = [
    Routes.AppsEditorGeneralInfo,
    Routes.AppsEditorSettings,
  ].some((route) => route === router.route);

  return (
    <div className="size-full">
      <Widgetbar />

      <div className="flex size-full flex-col md:flex-row ">
        {!isAppsEditorRoute && <Navigation />}
        {router.route === Routes.Chat &&
          enabledFeatures.has(Feature.ConversationsSection) && <Chatbar />}
        {router.route === Routes.Marketplace && <MarketplaceFilterbar />}
        <div className="grow overflow-hidden">{children}</div>
        {router.route === Routes.Chat &&
          enabledFeatures.has(Feature.PromptsSection) && <Promptbar />}
      </div>
    </div>
  );
};
