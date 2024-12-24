import { useCallback, useEffect, useRef } from 'react';

import { DialAIEntityModel } from '../types/models';

import { Tiktoken, get_encoding } from 'tiktoken';

export const useTokenizer = (tokenizer: DialAIEntityModel['tokenizer']) => {
  const encodingRef = useRef<Tiktoken | null>(null);

  useEffect(() => {
    // clean up if tokenizer changed
    if (encodingRef.current) {
      encodingRef.current.free();
      encodingRef.current = null;
    }

    // use macrotask to not block the thread
    const timerId = setTimeout(() => {
      if (tokenizer?.encoding) {
        encodingRef.current = get_encoding(tokenizer.encoding);
      }
    }, 0);

    return () => {
      if (encodingRef.current) {
        encodingRef.current.free();
        encodingRef.current = null;
      }

      clearTimeout(timerId);
    };
  }, [tokenizer]);

  const getTokensLength = useCallback((str: string) => {
    return encodingRef.current?.encode(str).length ?? new Blob([str]).size;
  }, []);

  return {
    getTokensLength,
  };
};
