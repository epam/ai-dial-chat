import { useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia?.(query);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
};
const getSnapshot = () => window.matchMedia?.(query).matches ?? false;

/** Cancel imperative decoration when motion preferences change during playback. */
export const useReducedMotion = () =>
  useSyncExternalStore(subscribe, getSnapshot, () => true);
