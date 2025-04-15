import { MouseEvent, TouchEvent, useCallback, useRef } from 'react';

const PRESS_THRESHOLD = 500;

export const useContextMenuTrigger = (
  cb: (e: MouseEvent | TouchEvent) => void,
) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const timer = useRef<number | null>(null);

  const handleContextMenuEvent = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      cb(e);
    },
    [cb],
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timer.current = new Date().valueOf();
      timeoutRef.current = setTimeout(() => cb(e), PRESS_THRESHOLD);
    },
    [cb],
  );

  const handleTouchEnd = useCallback(() => {
    if (
      timer.current &&
      new Date().valueOf() - timer.current < PRESS_THRESHOLD
    ) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
      timer.current = null;
    }
  }, []);

  return {
    onContextMenu: handleContextMenuEvent,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
};
