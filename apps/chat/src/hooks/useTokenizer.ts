import { useCallback, useEffect, useState } from 'react';

import { DialAIEntityModel } from '../types/models';

import { Tiktoken, get_encoding } from 'tiktoken';

export const useTokenizer = (tokenizer: DialAIEntityModel['tokenizer']) => {
  const [encoding, setEncoding] = useState<Tiktoken | undefined>(undefined);

  useEffect(() => {
    if (tokenizer?.encoding) {
      setEncoding(get_encoding(tokenizer.encoding));
    }
  }, [tokenizer]);

  useEffect(() => {
    return () => encoding?.free();
  }, []);

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
