import { useEffect, useRef } from 'react';

type ResizeHandler = () => void;

export const useWindowResizeEvent = (handleResize: ResizeHandler) => {
  const isRefreshing = useRef(false);
  const touchStartY = useRef(0);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;
      const diff = touchY - touchStartY.current;

      if (diff > 0 && window.scrollY === 0) {
        isRefreshing.current = true;
      }
    };

    const handleTouchEnd = () => {
      setTimeout(() => {
        isRefreshing.current = false;
      }, 100);
    };

    const handleResizeEvent = () => {
      if (!isRefreshing.current) {
        handleResize();
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('resize', handleResizeEvent);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResizeEvent);
    };
  }, [handleResize]);
};
