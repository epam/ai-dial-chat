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

    // use microtask to not block the thread and isMounted variable to prevent task execution if component unmounted
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted && tokenizer?.encoding) {
        encodingRef.current = get_encoding(tokenizer.encoding);
      }
    });

    return () => {
      isMounted = false;
      if (encodingRef.current) {
        encodingRef.current.free();
        encodingRef.current = null;
      }
    };
  }, [tokenizer]);

  const getTokensLength = useCallback((str: string) => {
    return encodingRef.current?.encode(str).length ?? new Blob([str]).size;
  }, []);

  return {
    getTokensLength,
  };
};
