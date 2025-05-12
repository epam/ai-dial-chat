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
