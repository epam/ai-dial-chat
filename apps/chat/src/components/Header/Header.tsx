import { useCallback, useEffect, useState } from 'react';

import classNames from 'classnames';

import { isSmallScreen, isTabletScreen } from '@/src/utils/app/mobile';
import { centralChatWidth, getNewSidebarWidth } from '@/src/utils/app/sidebar';

import { ApplicationSelectors } from '@/src/store/application/application.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { CENTRAL_CHAT_MIN_WIDTH } from '@/src/constants/chat';
import {
  DEFAULT_HEADER_ICON_SIZE,
  OVERLAY_HEADER_ICON_SIZE,
} from '@/src/constants/default-ui-settings';

import { ToggleSidebarButton } from '../Common/Buttons/ToggleSidebarButtor';
import { SettingDialog } from '../Settings/SettingDialog';
import { CreateNewConversation } from './CreateNewEntity';
import { Logo } from './Logo';
import { User } from './User/User';

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

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const handleToggleChatbar = useCallback(() => {
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
  }, [chatbarWidth, dispatch, promptbarWidth, showChatbar, windowWidth]);

  const handleTogglePromtbar = useCallback(() => {
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
  }, [chatbarWidth, dispatch, promptbarWidth, showPromptbar, windowWidth]);

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
      {enabledFeatures.has(Feature.ConversationsSection) && !selectedWidget && (
        <ToggleSidebarButton
          iconSize={headerIconSize}
          tooltip="Conversation list"
          isOpened={showChatbar}
          onToggle={handleToggleChatbar}
          dataQa="left-panel-toggle"
        />
      )}
      <div className="ml-4">
        {!enabledFeatures.has(Feature.HideNewConversation) &&
          !showChatbar &&
          !selectedWidget && (
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
        <ToggleSidebarButton
          iconSize={headerIconSize}
          tooltip="Prompt list"
          isOpened={showPromptbar}
          onToggle={handleTogglePromtbar}
          dataQa="right-panel-toggle"
          rightSide
        />
      )}
      <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
    </div>
  );
});
export default Header;
