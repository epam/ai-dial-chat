import { useCallback, useEffect, useState } from 'react';
import { DefaultAgentMode } from '../../types/default-agent';
import { StorageKey } from '../../types/storage-key';
import {
  getFromLocalStorage,
  setToLocalStorage,
} from '../../utils/local-storage';

const PREFERENCE_CHANGE_EVENT = 'default-agent-preference-change';

/*
 * `getFromLocalStorage` yields `null` for a missing key but `''` outside a
 * browser, so an emptiness check — not `??` — is what maps both to the default.
 */
const readStoredPreference = (): string => {
  const stored = getFromLocalStorage(StorageKey.DefaultAgent);
  if (!stored) return DefaultAgentMode.LastUsedAgent;
  return stored;
};

/**
 * The agent a new chat starts with: `DefaultAgentMode.DefaultAgent`,
 * `DefaultAgentMode.LastUsedAgent`, or a deployment id. The default is
 * `LastUsedAgent`, which reproduces the pre-existing resolution order, so
 * introducing this preference changes nobody's next chat.
 *
 * The `CustomEvent` exists because `DeploymentsProvider` and the Settings
 * Preferences tab are mounted at the same time and must agree without a
 * reload: the tab writes the preference, and the provider has to see it before
 * the user's next new chat resolves. Plain `useState` would leave each
 * instance with its own stale copy.
 */
export const useDefaultAgentPreference = () => {
  const [preference, setPreferenceState] =
    useState<string>(readStoredPreference);

  useEffect(() => {
    const handleChange = (e: Event) => {
      setPreferenceState((e as CustomEvent<string>).detail);
    };
    window.addEventListener(PREFERENCE_CHANGE_EVENT, handleChange);
    return () =>
      window.removeEventListener(PREFERENCE_CHANGE_EVENT, handleChange);
  }, []);

  const setPreference = useCallback((value: string) => {
    setToLocalStorage(StorageKey.DefaultAgent, value);
    setPreferenceState(value);
    window.dispatchEvent(
      new CustomEvent<string>(PREFERENCE_CHANGE_EVENT, { detail: value }),
    );
  }, []);

  return { preference, setPreference };
};
