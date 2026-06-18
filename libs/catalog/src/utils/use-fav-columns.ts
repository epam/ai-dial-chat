import { useEffect, useState } from 'react';

/**
 * Returns the number of columns for the Favorites grid based on viewport width.
 * Breakpoints mirror the source design: ≥1800→6, ≥1550→5, ≥1100→4, ≥800→3, else 2.
 */
export const useFavColumns = (): number => {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (width >= 1800) return 6;
  if (width >= 1550) return 5;
  if (width >= 1100) return 4;
  if (width >= 800) return 3;
  return 2;
};
