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
export const isMediumScreen = () =>
  typeof window !== 'undefined' && window.innerWidth < 1280;
export const isMediumScreenOrMobile = () => isMediumScreen() || isMobile();

export const getScreenState = () => {
  if (isSmallScreen()) {
    return ScreenState.MOBILE;
  }

  if (isMediumScreen()) {
    return ScreenState.TABLET;
  }

  return ScreenState.DESKTOP;
};
