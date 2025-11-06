import { useCallback, useState } from 'react';

import { useWindowResizeEvent } from '@/src/hooks/useWindowResizeEvent';

import { isSmallScreen, isTabletScreen } from '@/src/utils/app/mobile';
import { centralChatWidth, getNewSidebarWidth } from '@/src/utils/app/sidebar';

import { UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors, UISelectors } from '@/src/store/selectors';

import { CENTRAL_CHAT_MIN_WIDTH } from '@/src/constants/chat';
import {
  DEFAULT_HEADER_ICON_SIZE,
  OVERLAY_HEADER_ICON_SIZE,
} from '@/src/constants/default-ui-settings';

import { ToggleSidebarButton } from '@/src/components/Buttons/ToggleSidebarButton';
import { SettingDialog } from '@/src/components/Settings/SettingDialog';

import { BaseHeader } from './BaseHeader';
import { CreateNewConversation } from './CreateNewEntity';
import { User } from './User/User';

import { Inversify } from '@epam/ai-dial-modulify-ui';
import { Feature } from '@epam/ai-dial-shared';

export const Header = Inversify.register('Header', () => {
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

  const handleResize = useCallback(() => {
    setWindowWidth(window.innerWidth);
  }, []);
  useWindowResizeEvent(handleResize);

  return (
    <BaseHeader
      LeftItems={
        <>
          {enabledFeatures.has(Feature.ConversationsSection) && (
            <ToggleSidebarButton
              iconSize={headerIconSize}
              tooltip="Conversation list"
              isOpened={showChatbar}
              onToggle={handleToggleChatbar}
              dataQa="left-panel-toggle"
              isOverlay={isOverlay}
            />
          )}
          <div className="w-12 md:w-16">
            {!enabledFeatures.has(Feature.HideNewConversation) &&
              !showChatbar && (
                <CreateNewConversation iconSize={headerIconSize} />
              )}
          </div>
        </>
      }
      RightItems={
        <>
          <div className="flex w-[48px] items-center justify-center md:w-auto">
            <User />
          </div>
          {enabledFeatures.has(Feature.PromptsSection) && (
            <ToggleSidebarButton
              iconSize={headerIconSize}
              tooltip="Prompt list"
              isOpened={showPromptbar}
              onToggle={handleTogglePromtbar}
              dataQa="right-panel-toggle"
              rightSide
              isOverlay={isOverlay}
            />
          )}
          <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
        </>
      }
    />
  );
});
