import { useCallback, useEffect, useState } from 'react';
import { StorageKey } from '../../types/storage-key';
import {
  getFromLocalStorage,
  setToLocalStorage,
} from '../../utils/local-storage';

const PREFERENCE_CHANGE_EVENT = 'celebration-preference-change';

/* Celebrations are opt-in: anything but an explicit 'true' reads as off. */
const readStoredPreference = (): boolean =>
  getFromLocalStorage(StorageKey.CelebrationsEnabled) === 'true';

/**
 * The user's opt-in to the operator's seasonal celebration. Every mounted
 * instance follows a write, so the Settings toggle reaches `CelebrationHost`
 * without a reload.
 */
export const useCelebrationPreference = () => {
  const [isEnabled, setIsEnabledState] =
    useState<boolean>(readStoredPreference);

  useEffect(() => {
    const handleChange = (e: Event) => {
      setIsEnabledState((e as CustomEvent<boolean>).detail);
    };
    window.addEventListener(PREFERENCE_CHANGE_EVENT, handleChange);
    return () =>
      window.removeEventListener(PREFERENCE_CHANGE_EVENT, handleChange);
  }, []);

  const setIsEnabled = useCallback((value: boolean) => {
    setToLocalStorage(StorageKey.CelebrationsEnabled, String(value));
    setIsEnabledState(value);
    window.dispatchEvent(
      new CustomEvent<boolean>(PREFERENCE_CHANGE_EVENT, { detail: value }),
    );
  }, []);

  return { isEnabled, setIsEnabled };
};
