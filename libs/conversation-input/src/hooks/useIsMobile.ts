import { useEffect, useState } from 'react';

const MOBILE_MAX = '(max-width: 768px)';

const resolveIsMobile = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(MOBILE_MAX).matches;

/**
 * Returns `true` when the viewport is below the `large_tablet` breakpoint (< 1024 px).
 * Self-contained mirror of the host app's `useIsMobile`; uses the same pixel boundary
 * so JS-driven branches and Tailwind responsive prefixes resolve to the same band.
 */
export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(resolveIsMobile);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const mql = window.matchMedia(MOBILE_MAX);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
};
