import { type RefObject, useEffect, useRef } from 'react';

/** Returns a ref for a list's container that, once `count` drops and focus is lost, focuses the list's first button. */
export const useListRemoveFocus = <T extends HTMLElement = HTMLElement>(
  count: number,
): RefObject<T | null> => {
  const ref = useRef<T>(null);
  const previous = useRef(count);

  useEffect(() => {
    const isShorter = count < previous.current;
    previous.current = count;
    if (!isShorter) return;
    /* The removed row took its buttons with it, so focus fell to the body. A
       host may remove after a confirm or a save, so the trigger is the
       shorter list, not the click. Focus a user moved elsewhere stays. */
    const active = document.activeElement;
    if (active != null && active !== document.body && active.isConnected)
      return;
    const container = ref.current;
    const target =
      container?.querySelector<HTMLElement>('ul button') ??
      container?.querySelector<HTMLElement>('button');
    target?.focus();
  }, [count]);

  return ref;
};
