import type { ApplicationResourceDependencyDto } from '@epam/ai-dial-chat-api-client';
import { useCallback, useMemo, useState } from 'react';
import {
  APPLICATION_ACCESS_CONTENT_TYPES,
  areResourceDependenciesEqual,
  mergeApplicationAccess,
  partitionResourceDependencies,
} from '../application-access';
import type {
  ApplicationAccessEntry,
  UseApplicationAccessOptions,
  UseApplicationAccessResult,
} from '../models';

interface DraftState {
  baseline: ApplicationResourceDependencyDto[];
  entries: ApplicationAccessEntry[];
}

/**
 * Holds the Access draft of an application. The baseline is the stored list
 * the hook starts from; the draft is the configured entries, merged with the
 * preserved ones only when a request value is built.
 * @param options - the stored list and the offered content types
 */
export const useApplicationAccess = (
  options: UseApplicationAccessOptions = {},
): UseApplicationAccessResult => {
  const contentTypes = options.contentTypes ?? APPLICATION_ACCESS_CONTENT_TYPES;
  const [state, setState] = useState<DraftState>(() => {
    const baseline = options.storedList ?? [];
    return {
      baseline,
      entries: partitionResourceDependencies(baseline, contentTypes).entries,
    };
  });

  const preserved = useMemo(
    () => partitionResourceDependencies(state.baseline, contentTypes).preserved,
    [state.baseline, contentTypes],
  );

  const merged = useMemo(
    () => mergeApplicationAccess(state.baseline, state.entries, contentTypes),
    [state.baseline, state.entries, contentTypes],
  );

  const isDirty = !areResourceDependenciesEqual(merged, state.baseline);

  const setEntries = useCallback((entries: ApplicationAccessEntry[]) => {
    setState((previous) => ({ ...previous, entries }));
  }, []);

  const reset = useCallback(
    (nextBaseline?: ApplicationResourceDependencyDto[]) => {
      setState((previous) => {
        const baseline = nextBaseline ?? previous.baseline;
        return {
          baseline,
          entries: partitionResourceDependencies(baseline, contentTypes)
            .entries,
        };
      });
    },
    [contentTypes],
  );

  const toRequestValue = useCallback(
    () => (isDirty ? merged : undefined),
    [isDirty, merged],
  );

  return {
    entries: state.entries,
    preserved,
    setEntries,
    isDirty,
    reset,
    toRequestValue,
  };
};
