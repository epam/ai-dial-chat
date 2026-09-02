import { useCallback, useMemo, useState } from 'react';

interface CitationCardState {
  /** `groupKey` of the currently open citation popup, or `null` when closed. */
  openGroupKey: string | null;
  /** Per-group active annotation index, keyed by `groupKey`. */
  activeIndexByGroup: Record<string, number>;
}

const initialState: CitationCardState = {
  openGroupKey: null,
  activeIndexByGroup: {},
};

/**
 * Manages open/close state and per-group active annotation index for citation
 * cards within a single assistant message. State is keyed by
 * `AnnotationGroup.groupKey`, not `sourceUrl` — two groups can share a
 * `sourceUrl` (e.g. two `cit`-id groups citing the same document) while
 * having independent popup/switcher state.
 */
export const useCitationCard = () => {
  const [state, setState] = useState<CitationCardState>(initialState);

  const openPopup = useCallback((groupKey: string) => {
    setState((prev) => ({ ...prev, openGroupKey: groupKey }));
  }, []);

  const closePopup = useCallback(() => {
    setState((prev) => ({ ...prev, openGroupKey: null }));
  }, []);

  const setActiveIndex = useCallback((groupKey: string, index: number) => {
    setState((prev) => ({
      ...prev,
      activeIndexByGroup: { ...prev.activeIndexByGroup, [groupKey]: index },
    }));
  }, []);

  return useMemo(
    () => ({
      openPopup,
      closePopup,
      setActiveIndex,
      isOpen: (groupKey: string) => state.openGroupKey === groupKey,
      getActiveIndex: (groupKey: string) =>
        state.activeIndexByGroup[groupKey] ?? 0,
    }),
    [openPopup, closePopup, setActiveIndex, state],
  );
};
