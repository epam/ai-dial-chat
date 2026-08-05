import { useEffect, useState } from 'react';

/** Returns the column count for the Favorites grid: ≥1024 px → 4, ≥640 px → 2, else 1. */
export const useFavColumns = (): number => {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (width >= 1024) return 4;
  if (width >= 640) return 2;
  return 1;
};
