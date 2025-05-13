import { useEffect } from 'react';

export const useResizeObserver = (
  target: Element | null,
  callback: ResizeObserverCallback,
) => {
  useEffect(() => {
    if (!target) return;

    const observer = new ResizeObserver(callback);
    observer.observe(target);

    return () => observer.disconnect();
  }, [callback, target]);
};
