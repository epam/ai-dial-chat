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

const isScreenSize = (
  maxWidth: number,
  containerRef?: HTMLElement,
): boolean => {
  const width =
    containerRef?.clientWidth ??
    (typeof window !== 'undefined' ? window.innerWidth : 0);
  return width < maxWidth;
};

export const isSmallScreen = (containerRef?: HTMLElement) =>
  isScreenSize(ScreenState.SM, containerRef);
export const isTabletScreen = (containerRef?: HTMLElement) =>
  isScreenSize(ScreenState.MD, containerRef);
export const isXLScreen = (containerRef?: HTMLElement) =>
  isScreenSize(ScreenState.XL, containerRef);
export const is3XLScreen = (containerRef?: HTMLElement) =>
  isScreenSize(ScreenState.XL3, containerRef);
export const is4XLScreen = (containerRef?: HTMLElement) =>
  isScreenSize(ScreenState.XL4, containerRef);

export const isTabletScreenOrMobile = () => isTabletScreen() || isMobile();

export const getScreenState = (containerRef?: HTMLElement) => {
  const screenMappings = [
    { check: isSmallScreen, state: ScreenState.SM },
    { check: isTabletScreen, state: ScreenState.MD },
    { check: isXLScreen, state: ScreenState.XL },
    { check: is3XLScreen, state: ScreenState.XL3 },
    { check: is4XLScreen, state: ScreenState.XL4 },
  ];

  const found = screenMappings.find(({ check }) => check(containerRef));

  if (found) {
    return found.state;
  }

  return ScreenState.XL5;
};
