import { RefObject } from 'react';

export type InputElement = HTMLInputElement | HTMLTextAreaElement;
export const checkValidity = (
  inputsRefs: RefObject<InputElement>[],
): boolean => {
  let isValid = true;
  let focusableElement: InputElement | null = null;

  for (const { current } of inputsRefs) {
    if (!current) return false;

    const isEmpty =
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      !current.value || (current.value === 'on' && !(current as any).checked);

    if (current.required && isEmpty) {
      current.focus();
      current.blur();
      isValid = false;

      if (!focusableElement) {
        focusableElement = current;
        break;
      }
    }
  }

  focusableElement?.focus();

  return isValid;
};
