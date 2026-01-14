import { KeyboardEvent as ReactKeyboardEvent } from 'react';

import { EnterType } from '@/src/types/settings';

import { isMacOs, isMobile, isTabletScreenOrMobile } from './mobile';

export const allowEnterClick =
  (enterType: EnterType, isOverlay: boolean) =>
  <T>(e: KeyboardEvent | ReactKeyboardEvent<T>) => {
    if (
      e.key !== 'Enter' ||
      (isTabletScreenOrMobile() && (!isOverlay || isMobile())) ||
      e.shiftKey ||
      e.altKey
    ) {
      return false;
    }
    if (enterType !== EnterType.CtrlEnter) {
      return !e.metaKey && !e.ctrlKey;
    }
    return isMacOs ? e.metaKey : e.ctrlKey && !e.metaKey;
  };
