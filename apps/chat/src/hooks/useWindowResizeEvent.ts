import { useEffect } from 'react';

type ResizeHandler = () => void;

export const useWindowResizeEvent = (handleResize: ResizeHandler) => {
  useEffect(() => {
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);
};
