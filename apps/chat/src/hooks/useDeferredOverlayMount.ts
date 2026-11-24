import { useHasBeenTrue } from '@epam/ai-dial-chat-shared';
import { useIsAfterLoadIdle } from './useIsAfterLoadIdle';

/**
 * Returns whether a lazily loaded overlay should be mounted: from the
 * post-load idle point on, or earlier if it opens before then. Once `true` it
 * stays `true`.
 *
 * A mounted `React.lazy` component downloads its chunk even while it renders
 * nothing, so an overlay mounted at page load competes with the route's first
 * paint. Mounting it, still closed, once the page has loaded keeps the first
 * open as it was: the chunk is in place and the overlay animates open from
 * its closed state. Only an overlay opened before that point mounts already
 * open.
 */
export const useDeferredOverlayMount = (isOpen: boolean): boolean => {
  const hasOpened = useHasBeenTrue(isOpen);
  const isAfterLoadIdle = useIsAfterLoadIdle();
  return hasOpened || isAfterLoadIdle;
};
