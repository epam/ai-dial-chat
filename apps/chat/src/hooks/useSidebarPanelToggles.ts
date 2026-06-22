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

export const useSidebarPanelToggles = () => {
  const showChatbar = useAppSelector(UISelectors.selectShowChatbar);
  const showPromptbar = useAppSelector(UISelectors.selectShowPromptbar);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const chatbarWidth = useAppSelector(UISelectors.selectChatbarWidth);
  const promptbarWidth = useAppSelector(UISelectors.selectPromptbarWidth);

  const dispatch = useAppDispatch();

  const [windowWidth, setWindowWidth] = useState<number | undefined>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
  });

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

  const headerIconSize = isOverlay
    ? OVERLAY_HEADER_ICON_SIZE
    : DEFAULT_HEADER_ICON_SIZE;

  const handleResize = useCallback(() => {
    setWindowWidth(window.innerWidth);
  }, []);
  useWindowResizeEvent(handleResize);

  return {
    showChatbar,
    showPromptbar,
    isOverlay,
    headerIconSize,
    handleToggleChatbar,
    handleTogglePromtbar,
  };
};
