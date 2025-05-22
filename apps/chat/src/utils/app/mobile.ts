import { isMobile as isMobileValue, isTablet } from 'react-device-detect';

import { ScreenState } from '@/src/types/common';

export const isMobile = () => isMobileValue;
export const isTouchable = () => isMobileValue || isTablet;

const isScreenSize = (maxWidth: number): boolean =>
  typeof window !== 'undefined' && window.innerWidth < maxWidth;
export const isSmallScreen = () => isScreenSize(ScreenState.SM);
export const isTabletScreen = () => isScreenSize(ScreenState.MD);
export const isXLScreen = () => isScreenSize(ScreenState.XL);
export const is3XLScreen = () => isScreenSize(ScreenState.XL3);
export const is4XLScreen = () => isScreenSize(ScreenState.XL4);

export const isTabletScreenOrMobile = () => isTabletScreen() || isMobile();
export const isSmallScreenOrTouchable = () => isSmallScreen() || isTouchable();

export const getScreenState = () => {
  const screenMappings = [
    { check: isSmallScreen, state: ScreenState.SM },
    { check: isTabletScreen, state: ScreenState.MD },
    { check: isXLScreen, state: ScreenState.XL },
    { check: is3XLScreen, state: ScreenState.XL3 },
    { check: is4XLScreen, state: ScreenState.XL4 },
  ];

  const found = screenMappings.find(({ check }) => check());

  if (found) {
    return found.state;
  }

  return ScreenState.XL5;
};
