import { useEffect, useState } from 'react';

export const isMobile = () => {
  if (typeof window !== 'undefined') {
    const userAgent =
      typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
    const mobileRegex =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
    return mobileRegex.test(userAgent);
  }
  return false;
};

export const isSmallScreen = () => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 768;
  }
  return false;
};

//Function to cover all visible parts in the TourGuide
export const isNotFullScreen = () => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 1280;
  }
  return false;
};

export const isSmallScreenOrMobile = () => isSmallScreen() || isMobile();

//Hook to dynamically track window size changes
export const useIsSmallScreenOrMobile = () => {
  const [isSmallOrMobile, setIsSmallOrMobile] = useState(
    isNotFullScreen() || isMobile(),
  );

  useEffect(() => {
    const handleResize = () => {
      setIsSmallOrMobile(isNotFullScreen() || isMobile());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return isSmallOrMobile;
};
