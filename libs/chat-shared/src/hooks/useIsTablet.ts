import { useEffect, useState } from 'react';
import { TABLET_MEDIA_QUERY } from '../constants/breakpoint';

const resolveMatches = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(TABLET_MEDIA_QUERY).matches;

/** Tracks the tablet surface policy without changing the app's layout breakpoint. */
export const useIsTablet = (): boolean => {
  const [matches, setMatches] = useState(resolveMatches);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const query = window.matchMedia(TABLET_MEDIA_QUERY);
    const onChange = () => setMatches(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return matches;
};
