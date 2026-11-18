import { MOBILE_MEDIA_QUERY } from '../constants/breakpoint';
import { useMediaQueryMatch } from './useMediaQueryMatch';

/** Returns whether the viewport currently matches the mobile media query, updating on resize. */
export const useIsMobile = (): boolean =>
  useMediaQueryMatch(MOBILE_MEDIA_QUERY);
