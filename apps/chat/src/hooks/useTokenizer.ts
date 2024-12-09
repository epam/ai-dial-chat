import { useCallback, useEffect, useState } from 'react';

import { DialAIEntityModel } from '../types/models';

import { Tiktoken, getEncoding } from 'js-tiktoken';

export const useTokenizer = (tokenizer: DialAIEntityModel['tokenizer']) => {
  const [encoding, setEncoding] = useState<Tiktoken | undefined>(undefined);

  useEffect(() => {
    if (tokenizer?.encoding) {
      setEncoding(getEncoding(tokenizer.encoding));
    }
  }, [tokenizer]);

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
