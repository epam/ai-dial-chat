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
 * browser, so an emptiness check — not `??` — is what maps both to "nothing
 * stored". The absence is preserved rather than collapsed into the default,
 * because resolution has to tell an explicitly chosen `LastUsedAgent` from an
 * untouched preference: the explicit choice outranks a pinned operator
 * default, the untouched one still falls through to it.
 */
const readStoredPreference = (): string | null => {
  const stored = getFromLocalStorage(StorageKey.DefaultAgent);
  if (!stored) return null;
  return stored;
};

/**
 * The agent a new chat starts with: `DefaultAgentMode.DefaultAgent`,
 * `DefaultAgentMode.LastUsedAgent`, or a deployment id.
 *
 * `preference` is the value a control displays, so it substitutes
 * `LastUsedAgent` when nothing is stored. `storedPreference` is the raw value —
 * `null` until the user picks something — and is what `resolveInitialSelection`
 * reads, because only an explicit choice outranks a pinned operator default.
 *
 * The `CustomEvent` exists because `DeploymentsProvider` and the Settings
 * Preferences tab are mounted at the same time and must agree without a
 * reload: the tab writes the preference, and the provider has to see it before
 * the user's next new chat resolves. Plain `useState` would leave each
 * instance with its own stale copy.
 */
export const useDefaultAgentPreference = () => {
  const [storedPreference, setPreferenceState] = useState<string | null>(
    readStoredPreference,
  );

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

  return {
    preference: storedPreference ?? DefaultAgentMode.LastUsedAgent,
    storedPreference,
    setPreference,
  };
};
