import { IconMessage2 } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { Routes } from '@/src/constants/routes';

import { withRenderWhen } from '@/src/components/Common/RenderWhen';

import { MarketplaceNavigation } from './MarketplaceNavigation';
import { NavigationButton } from './NavigationButton';
import { WidgetsNavigation } from './WidgetsNavigation';

const NavigationView = () => {
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const router = useRouter();

  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const handleChatClick = useCallback(() => {
    return router.push(Routes.Chat).then(() => {
      dispatch(
        ConversationsActions.setIsStartedCustomViewerConversation(false),
      );
      if (!selectedConversationIds.length) {
        dispatch(
          ConversationsActions.createNewConversations({
            names: [DEFAULT_CONVERSATION_NAME],
          }),
        );
      }
    });
  }, [dispatch, router, selectedConversationIds.length]);

  return (
    <div
      className={classNames(
        'order-last flex w-full shrink-0 flex-row items-center justify-around gap-2 border-tertiary bg-layer-3 md:z-40 md:order-none md:h-full md:flex-col md:justify-start md:border-r md:py-2',
        isOverlay ? 'h-[36px] md:w-[44px]' : 'h-[52px] md:w-[60px]',
      )}
      data-qa="navigation-panel"
    >
      <NavigationButton
        onClick={handleChatClick}
        tooltip={t('Chat')}
        Icon={IconMessage2}
        selected={router.route === Routes.Chat}
        dataQa="back-to-chat"
        caption={t('Chat')}
      />
      <MarketplaceNavigation />
      <WidgetsNavigation />
    </div>
  );
};

export const Navigation = withRenderWhen(UISelectors.selectIsNavigationVisible)(
  NavigationView,
);
