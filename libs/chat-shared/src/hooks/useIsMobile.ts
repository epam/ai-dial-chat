import { useEffect, useState } from 'react';
import { MOBILE_MEDIA_QUERY } from '../constants/breakpoint';

const resolveIsMobile = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(MOBILE_MEDIA_QUERY).matches;

/** Returns whether the viewport currently matches the mobile media query, updating on resize. */
export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(resolveIsMobile);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
};
