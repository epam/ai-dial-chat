import { useCallback, useEffect, useRef } from 'react';

import { DialAIEntityModel } from '@/src/types/models';

interface TokenizerInstance {
  encode(text: string): { length: number };
  free(): void;
}

export const useTokenizer = (tokenizer: DialAIEntityModel['tokenizer']) => {
  const encodingRef = useRef<TokenizerInstance | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Use macrotask to not block the thread
    const timerId = setTimeout(async () => {
      if (!cancelled && tokenizer?.encoding) {
        // Dynamic import is required to keep this hook HMR-safe.
        // Static import of tiktoken (WebAssembly) would break React Fast Refresh.
        const { getOrCreateEncoding } = await import(
          '@/src/utils/app/tokenizer'
        );

        if (!cancelled) {
          encodingRef.current = getOrCreateEncoding(tokenizer.encoding);
        }
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
      encodingRef.current = null;
    };
  }, [tokenizer]);

  const getTokensLength = useCallback((str: string) => {
    return encodingRef.current?.encode(str).length ?? new Blob([str]).size;
  }, []);

  return {
    getTokensLength,
  };
};
