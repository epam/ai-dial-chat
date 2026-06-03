import { ReactNode } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';

import { ChatModalsManager } from '@/src/components/Chat/ChatModalsManager';
import { Chatbar } from '@/src/components/Chatbar/Chatbar';
import { ConversationDialogs } from '@/src/components/Chatbar/ConversationDialogs';
import { MarketplaceFilterbar } from '@/src/components/Marketplace/MarketplaceFilterbar';
import { Promptbar } from '@/src/components/Promptbar/Promptbar';
import { PromptDialogs } from '@/src/components/Promptbar/components/PromptDialogs';

import { Navigation } from './Navigation';

import { Feature } from '@epam/ai-dial-shared';

interface NavigationWrapperProps {
  children: ReactNode;
}

export const NavigationWrapper = ({ children }: NavigationWrapperProps) => {
  const router = useRouter();

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const isMdSidebarOverlayBreakpoint = useAppSelector(
    SettingsSelectors.selectIsMdSidebarOverlayBreakpoint,
  );
  const isIsolatedView = useAppSelector(SettingsSelectors.selectIsIsolatedView);

  const shouldShowNavigation =
    !isIsolatedView &&
    (router.route === Routes.Chat ||
      router.route === Routes.Marketplace ||
      router.route === Routes.Widgets ||
      router.route === Routes.FileManager ||
      router.route === Routes.SelectedWidget);

  return (
    <div className="size-full">
      <div
        className={classNames(
          'flex size-full flex-col md:flex-row',
          enabledFeatures.has(Feature.ShowLayoutDividers) &&
            (isMdSidebarOverlayBreakpoint
              ? 'sidebar-overlay-md:[&>*+*]:border-s-[15px] sidebar-overlay-md:[&>*+*]:border-s-tertiary'
              : 'sidebar-overlay:[&>*+*]:border-s-[15px] sidebar-overlay:[&>*+*]:border-s-tertiary'),
        )}
      >
        {shouldShowNavigation && <Navigation />}
        {router.route === Routes.Chat &&
          enabledFeatures.has(Feature.ConversationsSection) && (
            <>
              <Chatbar />
              <ConversationDialogs />
            </>
          )}
        {router.route === Routes.Marketplace && <MarketplaceFilterbar />}
        <div className="grow overflow-hidden">{children}</div>
        {router.route === Routes.Chat &&
          enabledFeatures.has(Feature.PromptsSection) && (
            <>
              <Promptbar />
              <PromptDialogs />
            </>
          )}
      </div>
      <ChatModalsManager />
    </div>
  );
};
