import { useCallback, useEffect, useState } from 'react';
import { useAppConfig } from '../../context/AppConfigContext';
import { StorageKey } from '../../types/storage-key';
import {
  getFromLocalStorage,
  setToLocalStorage,
} from '../../utils/local-storage';

const PREFERENCE_CHANGE_EVENT = 'celebration-preference-change';

/* Only an explicit 'true'/'false' is the user's choice; anything else means
 * they never chose, which the operator default then decides. */
const readStoredPreference = (): boolean | null => {
  const stored = getFromLocalStorage(StorageKey.CelebrationsEnabled);
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return null;
};

/**
 * The user's choice for the operator's seasonal celebration, falling back to
 * the operator default (`config.celebrationsEnabledByDefault`) while they have
 * saved none. The default is read live and never written, so changing
 * `UI_EVENT_ENABLED_BY_DEFAULT` reaches everyone who never chose. Every
 * mounted instance follows a write, so the Settings toggle reaches
 * `CelebrationHost` without a reload.
 */
export const useCelebrationPreference = () => {
  const { config } = useAppConfig();
  const [storedPreference, setStoredPreference] = useState<boolean | null>(
    readStoredPreference,
  );

  useEffect(() => {
    const handleChange = (e: Event) => {
      setStoredPreference((e as CustomEvent<boolean>).detail);
    };
    window.addEventListener(PREFERENCE_CHANGE_EVENT, handleChange);
    return () =>
      window.removeEventListener(PREFERENCE_CHANGE_EVENT, handleChange);
  }, []);

  const setIsEnabled = useCallback((value: boolean) => {
    setToLocalStorage(StorageKey.CelebrationsEnabled, String(value));
    setStoredPreference(value);
    window.dispatchEvent(
      new CustomEvent<boolean>(PREFERENCE_CHANGE_EVENT, { detail: value }),
    );
  }, []);

  const isEnabled = storedPreference ?? config.celebrationsEnabledByDefault;

  return { isEnabled, setIsEnabled };
};
