import { useEffect, useState } from 'react';

/** Returns the current time, re-rendering the caller every `intervalMs` so relative labels keep moving. */
export const useNow = (intervalMs: number): Date => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
};
