import { useEffect } from 'react';

export const useResizeObserver = (
  target: Element | null,
  callback: ResizeObserverCallback,
) => {
  useEffect(() => {
    const observer = target ? new ResizeObserver(callback) : null;

    if (target) {
      observer?.observe(target);
    }

    return () => observer?.disconnect();
  }, [callback, target]);
};
