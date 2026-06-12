import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import { useCallback, useEffect, useState } from 'react';
import { StorageKey } from '../../constants/storage';
import {
  getFromLocalStorage,
  setToLocalStorage,
} from '../../utils/local-storage';

export const isMac =
  typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform || navigator.userAgent);

export const metaKey = isMac ? '⌘' : 'Ctrl';

const PREFERENCE_CHANGE_EVENT = 'keyboard-shortcut-preference-change';

const readStoredPreference = (): SendOnEnter => {
  const stored = getFromLocalStorage(StorageKey.KeyboardShortcut);
  return stored === SendOnEnter.MetaEnter
    ? SendOnEnter.MetaEnter
    : SendOnEnter.Enter;
};

export const useKeyboardShortcutPreference = () => {
  const [preference, setPreferenceState] =
    useState<SendOnEnter>(readStoredPreference);

  useEffect(() => {
    const handleChange = (e: Event) => {
      setPreferenceState((e as CustomEvent<SendOnEnter>).detail);
    };
    window.addEventListener(PREFERENCE_CHANGE_EVENT, handleChange);
    return () =>
      window.removeEventListener(PREFERENCE_CHANGE_EVENT, handleChange);
  }, []);

  const setPreference = useCallback((value: SendOnEnter) => {
    setToLocalStorage(StorageKey.KeyboardShortcut, value);
    setPreferenceState(value);
    window.dispatchEvent(
      new CustomEvent<SendOnEnter>(PREFERENCE_CHANGE_EVENT, { detail: value }),
    );
  }, []);

  return { preference, setPreference };
};
