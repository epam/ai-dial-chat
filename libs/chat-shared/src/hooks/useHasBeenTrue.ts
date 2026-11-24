import { useState } from 'react';

/**
 * Returns `true` from the first render in which `value` is `true`, and keeps
 * returning `true` after `value` turns `false` again.
 *
 * It lets a host mount a lazily loaded overlay the first time it opens rather
 * than at page load: a mounted `React.lazy` component requests its chunk even
 * while it renders nothing, so a closed panel would otherwise compete with the
 * first paint. Staying `true` keeps the overlay mounted after it closes, so
 * its close transition, focus return and live-region announcements behave as
 * if it had always been mounted.
 *
 * The latch is state updated during render, so the render that sees `value`
 * turn `true` already returns `true`; no extra commit is needed.
 */
export const useHasBeenTrue = (value: boolean): boolean => {
  const [hasBeenTrue, setHasBeenTrue] = useState(value);
  if (value && !hasBeenTrue) {
    setHasBeenTrue(true);
    return true;
  }
  return hasBeenTrue;
};
