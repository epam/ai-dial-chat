import { KeyboardEvent as ReactKeyboardEvent } from 'react';

import { EnterType } from '@/src/types/settings';

import { isMacOs, isTabletScreenOrMobile } from './mobile';

export const allowEnterClick = <T>(
  e: KeyboardEvent | ReactKeyboardEvent<T>,
  enterType: EnterType,
) => {
  if (e.key !== 'Enter' || isTabletScreenOrMobile() || e.shiftKey || e.altKey) {
    return false;
  }
  if (enterType !== EnterType.CtrlEnter) {
    return !e.metaKey && !e.ctrlKey;
  }
  return isMacOs ? e.metaKey : e.ctrlKey && !e.metaKey;
};
