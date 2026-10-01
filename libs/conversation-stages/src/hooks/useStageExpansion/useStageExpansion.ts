import { useCallback, useMemo, useState } from 'react';
import type { StageExpansionState } from '../../models/stage-tree';

/**
 * Holds the expand/collapse choices of one stage surface. Keys are stable
 * stage identities, so streaming updates, new siblings and retry-group
 * formation keep a still-present stage's choice. Every disclosure starts
 * collapsed; nothing is persisted.
 */
export const useStageExpansion = (): StageExpansionState => {
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const onToggle = useCallback((key: string, isExpanded: boolean) => {
    setExpandedKeys((previous) => {
      if (previous.has(key) === isExpanded) return previous;
      const next = new Set(previous);
      if (isExpanded) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setExpandedKeys((previous) => (previous.size ? new Set() : previous));
  }, []);

  return useMemo(
    () => ({
      isExpanded: (key: string) => expandedKeys.has(key),
      onToggle,
      reset,
    }),
    [expandedKeys, onToggle, reset],
  );
};
