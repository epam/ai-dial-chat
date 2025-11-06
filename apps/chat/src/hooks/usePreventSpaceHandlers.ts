import { useCallback } from 'react';

export const usePreventSpaceHandlers = () => {
  const onBeforeInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const inputEvent = e.nativeEvent as InputEvent;
    if (inputEvent.data?.includes(' ') || inputEvent.data === '. ') {
      e.preventDefault();
    }
  }, []);

  const onInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const cleaned = input.value.replace(/\s+/g, '').replace(/\.{2,}/g, '.');
    if (input.value !== cleaned) {
      input.value = cleaned;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, []);

  const onKeyDownOrPaste = useCallback(
    (
      e:
        | React.KeyboardEvent<HTMLInputElement>
        | React.ClipboardEvent<HTMLInputElement>,
    ) => {
      if (e.type === 'keydown') {
        const keyEvent = e as React.KeyboardEvent<HTMLInputElement>;
        if (keyEvent.key === ' ') {
          e.preventDefault();
        }
      } else if (e.type === 'paste') {
        e.preventDefault();
        const pasted = (
          e as React.ClipboardEvent<HTMLInputElement>
        ).clipboardData
          .getData('text')
          .replace(/\s+/g, '');
        const input = e.currentTarget;
        input.setRangeText(
          pasted,
          input.selectionStart ?? 0,
          input.selectionEnd ?? 0,
          'end',
        );
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
    [],
  );

  return {
    onBeforeInput,
    onInput,
    onKeyDownOrPaste,
  };
};
