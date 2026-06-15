import { useEffect, useState } from 'react';

const getInnerWidth = (): number =>
  typeof window !== 'undefined' ? window.innerWidth : 1024;

const useViewportWidth = (): number => {
  const [width, setWidth] = useState(getInnerWidth);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
};

export default useViewportWidth;
