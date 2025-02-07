import { MouseEvent, useCallback } from 'react';


export const useMenuItemHandler = <T>(
  handler: ((props: T) => void) | undefined,
  props: T,
  preventDefault = true,
) =>
  useCallback(
    (e: MouseEvent) => {
      if (preventDefault) {
        e.preventDefault();
      }
      e.stopPropagation();
      handler?.(props);
    },
    [preventDefault, handler, props],
  );

export const useMenuItemHandlerWithTwoArgs = <T, T2>(
  handler: ((arg1: T, arg2: T2) => void) | undefined,
  arg1: T,
  arg2: T2,
) =>
  useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handler?.(arg1, arg2);
    },
    [handler, arg1, arg2],
  );
