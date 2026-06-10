import { useCallback, useState } from 'react';
import { StorageKey } from '../../constants/storage';
import {
  getFromLocalStorage,
  setToLocalStorage,
} from '../../utils/local-storage';

export type KeyboardShortcutPreference = 'enter' | 'meta-enter';

export const isMac =
  typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform || navigator.userAgent);

export const metaKey = isMac ? '⌘' : 'Ctrl';

const readStoredPreference = (): KeyboardShortcutPreference => {
  const stored = getFromLocalStorage(StorageKey.KeyboardShortcut);
  return stored === 'meta-enter' ? 'meta-enter' : 'enter';
};

export const useKeyboardShortcutPreference = () => {
  const [preference, setPreferenceState] =
    useState<KeyboardShortcutPreference>(readStoredPreference);

  const setPreference = useCallback((value: KeyboardShortcutPreference) => {
    setToLocalStorage(StorageKey.KeyboardShortcut, value);
    setPreferenceState(value);
  }, []);

  return { preference, setPreference };
};
