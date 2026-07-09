import { getSelectorsByUserAgent } from 'react-device-detect';

import { ScreenState } from '@/src/types/common';

export const getDeviceSelectors = () =>
  getSelectorsByUserAgent(navigator.userAgent);

export const isMacOs = () => {
  const { isMacOs } = getDeviceSelectors();
  return isMacOs;
};

export const isMobile = () => {
  const { isMobileOnly, isTablet } = getDeviceSelectors();
  return isMobileOnly && !isTablet;
};
export const isTouchable = () => {
  if (typeof window !== 'undefined') {
    const hasCoarsePointer =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    const hasTouchPoints =
      typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

    if (hasCoarsePointer || hasTouchPoints) {
      return true;
    }
  }

  const { isMobileOnly, isTablet } = getDeviceSelectors();

  return isMobileOnly || isTablet;
};

const isScreenSize = (maxWidth: number): boolean =>
  typeof window !== 'undefined' && window.innerWidth < maxWidth;
const createCheck = (screenState: ScreenState) => () =>
  isScreenSize(screenState);
export const isSmallScreen = createCheck(ScreenState.SM);
export const isTabletScreen = createCheck(ScreenState.MD);
export const isXLScreen = createCheck(ScreenState.XL);
export const is3XLScreen = createCheck(ScreenState.XL3);
export const is4XLScreen = createCheck(ScreenState.XL4);

export const isTabletScreenOrMobile = () => isTabletScreen() || isMobile();
export const isSmallScreenOrTouchable = () => isSmallScreen() || isTouchable();

export const shouldAutoHideChatbarOnConversationChange = (
  isOverlay: boolean,
  isMdSidebarOverlayBreakpoint: boolean,
) =>
  isOverlay && isMdSidebarOverlayBreakpoint ? isMobile() : isTabletScreen();

export const shouldShowConversationsSectionByDefault = (
  isOverlay: boolean,
  isMdSidebarOverlayBreakpoint: boolean,
) => !isTabletScreenOrMobile() || (isOverlay && isMdSidebarOverlayBreakpoint);

export const getScreenState = () => {
  const screenMappings = [
    ScreenState.SM,
    ScreenState.MD,
    ScreenState.XL,
    ScreenState.XL3,
    ScreenState.XL4,
  ];

  const found = screenMappings.find((screenState) => isScreenSize(screenState));

  return found ?? ScreenState.XL5;
};
