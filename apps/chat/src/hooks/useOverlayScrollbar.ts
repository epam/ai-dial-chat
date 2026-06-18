import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

const THUMB_MIN_SIZE = 24;
const HIDE_DELAY = 1000;

interface OverlayScrollbar {
  visible: boolean;
  size: number;
  offset: number;
}

const EMPTY: OverlayScrollbar = { visible: false, size: 0, offset: 0 };

export const useOverlayScrollbar = (
  scrollRef: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
) => {
  const [vertical, setVertical] = useState<OverlayScrollbar>(EMPTY);
  const [horizontal, setHorizontal] = useState<OverlayScrollbar>(EMPTY);
  const [active, setActive] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const update = useCallback(() => {
    const el = scrollRef.current;

    if (!el) {
      return;
    }

    const { clientHeight, scrollHeight, scrollTop } = el;
    const { clientWidth, scrollWidth, scrollLeft } = el;

    if (scrollHeight > clientHeight) {
      const size = Math.max(
        (clientHeight / scrollHeight) * clientHeight,
        THUMB_MIN_SIZE,
      );
      const maxOffset = clientHeight - size;
      const offset =
        (scrollTop / (scrollHeight - clientHeight)) * maxOffset || 0;
      setVertical({ visible: true, size, offset });
    } else {
      setVertical(EMPTY);
    }

    if (scrollWidth > clientWidth) {
      const size = Math.max(
        (clientWidth / scrollWidth) * clientWidth,
        THUMB_MIN_SIZE,
      );
      const maxOffset = clientWidth - size;
      const offset =
        (scrollLeft / (scrollWidth - clientWidth)) * maxOffset || 0;
      setHorizontal({ visible: true, size, offset });
    } else {
      setHorizontal(EMPTY);
    }
  }, [scrollRef]);

  const reveal = useCallback(() => {
    setActive(true);

    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }

    hideTimer.current = setTimeout(() => setActive(false), HIDE_DELAY);
  }, []);

  const onScroll = useCallback(() => {
    update();
    reveal();
  }, [reveal, update]);

  useEffect(() => {
    update();

    const el = scrollRef.current;

    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => update());
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, ...deps]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, []);

  return {
    vertical,
    horizontal,
    active,
    onScroll,
    onMouseEnter: reveal,
  };
};
