import { KeyboardEvent as ReactKeyboardEvent } from 'react';

import { EnterType } from '@/src/types/settings';

import { isMacOs, isTouchable } from './mobile';

export const allowEnterClick =
  (enterType: EnterType) =>
  <T>(e: KeyboardEvent | ReactKeyboardEvent<T>) => {
    if (e.key !== 'Enter' || isTouchable() || e.shiftKey || e.altKey) {
      return false;
    }
    if (enterType !== EnterType.CtrlEnter) {
      return !e.metaKey && !e.ctrlKey;
    }
    return isMacOs() ? e.metaKey : e.ctrlKey && !e.metaKey;
  };
