import { useCallback, useEffect, useRef, useState } from 'react';

import { writeTextToClipboard } from '@/src/utils/app/clipboard';

export const useCopy = (content: string, convertFromMarkdown = false) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCopy = useCallback(() => {
    writeTextToClipboard(
      content,
      () => {
        setCopied(true);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setCopied(false);
        }, 2000);
      },
      { convertFromMarkdown },
    );
  }, [content, convertFromMarkdown]);
  useEffect(
    () => () => {
      if (timeoutRef.current) return clearTimeout(timeoutRef.current);
    },
    [],
  );
  return {
    onCopy,
    copied,
  };
};
