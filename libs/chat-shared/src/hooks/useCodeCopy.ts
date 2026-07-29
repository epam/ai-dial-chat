import { useCallback, useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '../utils/copy-to-clipboard';

const DEFAULT_RESET_DELAY_MS = 2000;

/** Returns `isCopied` state and a `copy` callback; `isCopied` resets to `false` after `resetDelay` ms. */
export const useCodeCopy = (
  value: string,
  resetDelay = DEFAULT_RESET_DELAY_MS,
): { isCopied: boolean; copy: () => void } => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(() => {
    void copyToClipboard(value).then((success) => {
      if (!success) return;
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
      }
      setIsCopied(true);
      timeoutRef.current = setTimeout(() => {
        setIsCopied(false);
      }, resetDelay);
    });
  }, [value, resetDelay]);

  return { isCopied, copy };
};
