import { PHONE_MEDIA_QUERY } from '../constants/breakpoint';
import { useMediaQueryMatch } from './useMediaQueryMatch';

/** Tracks the phone surface policy without changing the app's layout breakpoint. */
export const useIsPhone = (): boolean => useMediaQueryMatch(PHONE_MEDIA_QUERY);
