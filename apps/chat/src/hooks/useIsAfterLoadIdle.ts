import { useEffect, useState } from 'react';
import { isAfterLoadIdle, scheduleAfterLoadIdle } from '../utils/load-idle';

/**
 * Returns `true` once the page has passed its post-load idle point (see
 * `scheduleAfterLoadIdle`), and `true` straight away for a component mounted
 * after it.
 *
 * Use it to mount something that shows nothing at first paint, such as the
 * onboarding tour, so its lazy chunk does not compete with the route's own
 * chunks while the page loads.
 */
export const useIsAfterLoadIdle = (): boolean => {
  const [isReached, setIsReached] = useState(isAfterLoadIdle);

  useEffect(() => {
    if (isReached) return undefined;
    return scheduleAfterLoadIdle(() => setIsReached(true));
  }, [isReached]);

  return isReached;
};
