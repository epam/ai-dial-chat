import { useEffect } from 'react';

export const useResizeObserver = (
  target: Element | null,
  callback: () => void,
  callImmediately = false,
) => {
  if (callImmediately && target) {
    callback();
  }
  useEffect(() => {
    if (!target) return;

    const observer = new ResizeObserver(callback);
    observer.observe(target);

    return () => observer.disconnect();
  }, [callback, target]);
};
