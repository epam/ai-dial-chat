export const isMobile = () => {
  const userAgent =
    typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
  const mobileRegex =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  return mobileRegex.test(userAgent);
};

export const isSmallScreen = () => window.innerWidth < 768;
export const isMediumScreen = () => window.innerWidth < 1280;
export const isMediumScreenOrMobile = () => isMediumScreen() || isMobile();
