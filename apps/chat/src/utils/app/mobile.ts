import { isMobile as isMobileValue, isTablet } from 'react-device-detect';

import { ScreenState } from '@/src/types/common';

export const isMobile = () => isMobileValue && !isTablet;
export const isTouchable = () => isMobileValue || isTablet;

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
