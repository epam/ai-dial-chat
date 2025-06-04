import { useCallback, useEffect, useRef, useState } from 'react';

import debounce, { DebouncedFunc } from 'lodash-es/debounce';

export const useDebouncedInput = (
  initialValue: string,
  onCommit: (value: string) => void,
  delay = 500,
): [string, (value: string) => void] => {
  const [inputValue, setInputValue] = useState(initialValue);

  const inputValueRef = useRef<string>(inputValue);
  const debouncedChangeValueRef = useRef<DebouncedFunc<
    (value: string) => void
  > | null>(null);

  useEffect(() => {
    debouncedChangeValueRef.current = debounce(onCommit, delay);

    return () => {
      debouncedChangeValueRef.current?.cancel();
    };
  }, [onCommit, delay]);

  const handleDebouncedChangeValue = useCallback((value: string) => {
    setInputValue(value);
    inputValueRef.current = value;

    if (debouncedChangeValueRef.current) {
      debouncedChangeValueRef.current(inputValueRef.current);
    }
  }, []);

  return [inputValue, handleDebouncedChangeValue];
};
