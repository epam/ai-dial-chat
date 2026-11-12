import { useLayoutEffect, useState } from 'react';
import {
  OWN_OVERLAY_SELECTOR,
  TARGET_RESOLVE_THROTTLE_MS,
} from '../../constants/layout';

const isOwnMutation = (record: MutationRecord): boolean => {
  const node =
    record.target instanceof Element
      ? record.target
      : record.target.parentElement;
  return node?.closest(OWN_OVERLAY_SELECTOR) != null;
};

/** Returns the element `getTarget` resolves to, looked up again whenever the page's DOM or size changes. */
export const useResolvedTarget = (
  getTarget: (() => HTMLElement | null) | undefined,
): HTMLElement | null => {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!getTarget) {
      setTarget(null);
      return;
    }
    const resolve = () => setTarget(getTarget());
    resolve();

    /* Throttled: a streaming chat mutates the DOM on every frame. */
    let timer = 0;
    const schedule = () => {
      if (timer === 0) {
        timer = window.setTimeout(() => {
          timer = 0;
          resolve();
        }, TARGET_RESOLVE_THROTTLE_MS);
      }
    };
    const observer =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver((records) => {
            if (records.some((record) => !isOwnMutation(record))) {
              schedule();
            }
          });
    observer?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['inert', 'hidden', 'aria-hidden', 'class', 'style'],
    });
    window.addEventListener('resize', schedule);
    return () => {
      observer?.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener('resize', schedule);
    };
  }, [getTarget]);

  return target;
};
