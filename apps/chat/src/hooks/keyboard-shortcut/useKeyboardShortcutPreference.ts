import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import { useCallback, useState } from 'react';
import { StorageKey } from '../../constants/storage';
import {
  getFromLocalStorage,
  setToLocalStorage,
} from '../../utils/local-storage';

export const isMac =
  typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform || navigator.userAgent);

export const metaKey = isMac ? '⌘' : 'Ctrl';

const readStoredPreference = (): SendOnEnter => {
  const stored = getFromLocalStorage(StorageKey.KeyboardShortcut);
  return stored === SendOnEnter.MetaEnter
    ? SendOnEnter.MetaEnter
    : SendOnEnter.Enter;
};

export const useKeyboardShortcutPreference = () => {
  const [preference, setPreferenceState] =
    useState<SendOnEnter>(readStoredPreference);

  const setPreference = useCallback((value: SendOnEnter) => {
    setToLocalStorage(StorageKey.KeyboardShortcut, value);
    setPreferenceState(value);
  }, []);

  return { preference, setPreference };
};
