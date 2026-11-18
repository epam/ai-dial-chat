import { TABLET_MEDIA_QUERY } from '../constants/breakpoint';
import { useMediaQueryMatch } from './useMediaQueryMatch';

/** Tracks the tablet surface policy without changing the app's layout breakpoint. */
export const useIsTablet = (): boolean =>
  useMediaQueryMatch(TABLET_MEDIA_QUERY);
