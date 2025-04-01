import { IconX } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { dispatchMouseLeaveEvent } from '@/src/utils/app/common';
import { isSmallScreen, isTabletScreen } from '@/src/utils/app/mobile';
import { centralChatWidth, getNewSidebarWidth } from '@/src/utils/app/sidebar';

import { Translation } from '@/src/types/translation';

import { ApplicationSelectors } from '@/src/store/application/application.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { CENTRAL_CHAT_MIN_WIDTH } from '@/src/constants/chat';
import {
  DEFAULT_HEADER_ICON_SIZE,
  OVERLAY_HEADER_ICON_SIZE,
} from '@/src/constants/default-ui-settings';

import Tooltip from '../Common/Tooltip';
import { SettingDialog } from '../Settings/SettingDialog';
import { CreateNewConversation } from './CreateNewEntity';
import { Logo } from './Logo';
import { User } from './User/User';

import MoveLeftIcon from '@/public/images/icons/move-left.svg';
import MoveRightIcon from '@/public/images/icons/move-right.svg';
import { Inversify } from '@epam/ai-dial-modulify-ui';
import { Feature } from '@epam/ai-dial-shared';

const Header = Inversify.register('Header', () => {
  const showChatbar = useAppSelector(UISelectors.selectShowChatbar);
  const showPromptbar = useAppSelector(UISelectors.selectShowPromptbar);
  const isUserSettingsOpen = useAppSelector(
    UISelectors.selectIsUserSettingsOpen,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const [windowWidth, setWindowWidth] = useState<number | undefined>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
  });

  const chatbarWidth = useAppSelector(UISelectors.selectChatbarWidth);
  const promptbarWidth = useAppSelector(UISelectors.selectPromptbarWidth);
  const selectedWidget = useAppSelector(
    ApplicationSelectors.selectSelectedWidget,
  );

  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Header);
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const handleToggleChatbar = useCallback(
    (e: React.MouseEvent) => {
      dispatchMouseLeaveEvent(e);

      if (!showChatbar && isTabletScreen()) {
        dispatch(UIActions.setShowPromptbar(false));
      }

      if (!showChatbar && isSmallScreen()) {
        dispatch(UIActions.setIsProfileOpen(false));
      }

      if (!showChatbar && !isTabletScreen()) {
        if (!windowWidth) return;
        const calculatedChatWidth = centralChatWidth({
          oppositeSidebarWidth: promptbarWidth,
          windowWidth,
          currentSidebarWidth: chatbarWidth,
        });

        if (calculatedChatWidth < CENTRAL_CHAT_MIN_WIDTH) {
          const newPromptbarWidth = getNewSidebarWidth({
            windowWidth,
            oppositeSidebarWidth: chatbarWidth,
          });
          dispatch(UIActions.setPromptbarWidth(newPromptbarWidth));
        }
      }

      dispatch(UIActions.setShowChatbar(!showChatbar));
    },
    [chatbarWidth, dispatch, promptbarWidth, showChatbar, windowWidth],
  );

  const handleTogglePromtbar = useCallback(
    (e: React.MouseEvent) => {
      dispatchMouseLeaveEvent(e);

      if (!showPromptbar && isTabletScreen()) {
        dispatch(UIActions.setShowChatbar(false));
      }

      if (!showPromptbar && isSmallScreen()) {
        dispatch(UIActions.setIsProfileOpen(false));
      }

      if (!showPromptbar && !isTabletScreen()) {
        if (!windowWidth) return;
        const calculatedChatWidth = centralChatWidth({
          oppositeSidebarWidth: chatbarWidth,
          windowWidth,
          currentSidebarWidth: promptbarWidth,
        });

        if (calculatedChatWidth < CENTRAL_CHAT_MIN_WIDTH) {
          const newChatbarWidth = getNewSidebarWidth({
            windowWidth,
            oppositeSidebarWidth: promptbarWidth,
          });
          dispatch(UIActions.setChatbarWidth(newChatbarWidth));
        }
      }

      dispatch(UIActions.setShowPromptbar(!showPromptbar));
    },
    [chatbarWidth, dispatch, promptbarWidth, showPromptbar, windowWidth],
  );

  const onClose = () => {
    dispatch(UIActions.setIsUserSettingsOpen(false));
  };

  const headerIconSize = isOverlay
    ? OVERLAY_HEADER_ICON_SIZE
    : DEFAULT_HEADER_ICON_SIZE;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      className={classNames(
        'z-30 flex w-full border-b border-secondary bg-layer-1',
        isOverlay ? 'min-h-[36px]' : 'min-h-[49px]',
      )}
      data-qa="header"
    >
      {enabledFeatures.has(Feature.ConversationsSection) && (
        <Tooltip isTriggerClickable tooltip={t('Conversation list')}>
          <div
            className="flex h-full cursor-pointer items-center justify-center px-3 md:px-5"
            onClick={handleToggleChatbar}
            data-qa="left-panel-toggle"
          >
            {showChatbar ? (
              <>
                <IconX
                  className="text-secondary md:hidden"
                  width={headerIconSize}
                  height={headerIconSize}
                />

                <MoveLeftIcon
                  className="text-secondary hover:text-accent-secondary max-md:hidden"
                  width={headerIconSize}
                  height={headerIconSize}
                />
              </>
            ) : (
              <MoveRightIcon
                className="text-secondary hover:text-accent-secondary"
                width={headerIconSize}
                height={headerIconSize}
              />
            )}
          </div>
        </Tooltip>
      )}
      <div className="ml-4">
        {!enabledFeatures.has(Feature.HideNewConversation) && !showChatbar && (
          <CreateNewConversation iconSize={headerIconSize} />
        )}
      </div>
      <div className="flex grow justify-center">
        <Logo />
      </div>
      <div className="flex w-[48px] items-center justify-center max-md:border-l max-md:border-tertiary md:w-auto">
        <User />
      </div>
      {enabledFeatures.has(Feature.PromptsSection) && !selectedWidget && (
        <Tooltip isTriggerClickable tooltip={t('Prompt list')}>
          <div
            className="flex h-full cursor-pointer items-center justify-center px-3 md:px-5"
            onClick={handleTogglePromtbar}
            data-qa="right-panel-toggle"
          >
            {showPromptbar ? (
              <>
                <IconX
                  className="text-secondary md:hidden"
                  width={headerIconSize}
                  height={headerIconSize}
                />

                <MoveLeftIcon
                  className="rotate-180 text-secondary hover:text-accent-tertiary max-md:hidden"
                  width={headerIconSize}
                  height={headerIconSize}
                />
              </>
            ) : (
              <MoveRightIcon
                className="rotate-180 text-secondary hover:text-accent-tertiary"
                width={headerIconSize}
                height={headerIconSize}
              />
            )}
          </div>
        </Tooltip>
      )}
      <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
    </div>
  );
});
export default Header;
