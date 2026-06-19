import { copyToClipboard } from '@epam/ai-dial-chat-shared';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_RESET_DELAY_MS = 2000;

/**
 * Manages clipboard copy state for code blocks.
 *
 * Calls `copyToClipboard` synchronously within the user-gesture handler
 * (required by the Clipboard API). `isCopied` is set to `true` only when the
 * write succeeds; it stays `true` for `resetDelay` milliseconds (default 2 s)
 * then resets to `false`. The timeout is cleared on unmount to prevent
 * setState-on-unmount.
 */
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
