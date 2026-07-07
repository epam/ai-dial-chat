import { KeyboardEvent as ReactKeyboardEvent } from 'react';

import { EnterType } from '@/src/types/settings';

import { isMacOs, isTouchable } from './mobile';

const isComposing = <T>(e: KeyboardEvent | ReactKeyboardEvent<T>) =>
  // `isComposing`/keyCode 229 signal that the keypress belongs to an active
  // IME composition (e.g. Android/Gboard), where Enter must insert a newline
  // rather than submit.
  ('isComposing' in e && e.isComposing) ||
  ('nativeEvent' in e && e.nativeEvent.isComposing) ||
  e.keyCode === 229;

export const allowEnterClick =
  (enterType: EnterType) =>
  <T>(e: KeyboardEvent | ReactKeyboardEvent<T>) => {
    if (
      e.key !== 'Enter' ||
      isTouchable() ||
      isComposing(e) ||
      e.shiftKey ||
      e.altKey
    ) {
      return false;
    }
    if (enterType !== EnterType.CtrlEnter) {
      return !e.metaKey && !e.ctrlKey;
    }
    return isMacOs() ? e.metaKey : e.ctrlKey && !e.metaKey;
  };
