import { useEffect, useRef } from 'react';

type ResizeHandler = () => void;

/**
 * A custom hook that handles window resize events while preventing unwanted resize triggers
 * during mobile pull-to-refresh gestures.
 *
 * This hook is particularly useful for mobile web applications where you want to handle
 * window resize events but need to distinguish between actual resize events and
 * pull-to-refresh gestures that might trigger resize events.
 *
 * @param handleResize - A callback function that will be called when a valid resize event occurs.
 *                      This function will not be called during pull-to-refresh gestures.
 *
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const handleResize = () => {
 *     // Handle resize logic here
 *   };
 *
 *   useWindowResizeEvent(handleResize);
 *
 *   return <div>My Component</div>;
 * };
 * ```
 */
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

    let timeoutId: NodeJS.Timeout;
    const handleTouchEnd = () => {
      timeoutId = setTimeout(() => {
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
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResizeEvent);
    };
  }, [handleResize]);
};
