import { useCallback, useEffect, useState } from 'react';

import { DialAIEntityModel } from '../types/models';

import { Tiktoken, get_encoding } from 'tiktoken';

export const useTokenizer = (tokenizer: DialAIEntityModel['tokenizer']) => {
  const [encoding, setEncoding] = useState<Tiktoken>();

  useEffect(() => {
    // use an event loop macro task to avoid blocking rendering
    const timeoutId = setTimeout(() => {
      if (tokenizer?.encoding) {
        setEncoding(get_encoding(tokenizer.encoding));
      }
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      encoding?.free();
    };
  }, [encoding, tokenizer]);

  const getTokensLength = useCallback(
    (str: string) => {
      return encoding?.encode(str).length ?? new Blob([str]).size;
    },
    [encoding],
  );

  return {
    getTokensLength,
  };
};
