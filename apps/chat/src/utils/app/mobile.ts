import { ScreenState } from '@/src/types/common';

export const isMobile = () => {
  const userAgent =
    typeof window === 'undefined' || typeof window.navigator === 'undefined'
      ? ''
      : navigator.userAgent;
  const mobileRegex =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  return mobileRegex.test(userAgent);
};

export const isSmallScreen = () =>
  typeof window !== 'undefined' && window.innerWidth < 768;
export const isTabletScreen = () =>
  typeof window !== 'undefined' && window.innerWidth < 1280;
export const isXLScreen = () =>
  typeof window !== 'undefined' && window.innerWidth < 1770;
export const is3XLScreen = () =>
  typeof window !== 'undefined' && window.innerWidth < 2120;
export const is4XLScreen = () =>
  typeof window !== 'undefined' && window.innerWidth < 2560;
export const isTabletScreenOrMobile = () => isTabletScreen() || isMobile();

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
