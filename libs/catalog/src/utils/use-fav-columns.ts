import { useEffect, useState } from 'react';

/**
 * Returns the number of columns for the Favorites grid based on viewport width.
 * Breakpoints: ≥1800→6, ≥1550→5, ≥1250→4, ≥950→3, ≥650→2, else 1.
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
  if (width >= 1250) return 4;
  if (width >= 950) return 3;
  if (width >= 650) return 2;
  return 1;
};
