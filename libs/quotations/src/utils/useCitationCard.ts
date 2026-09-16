import { useCallback, useMemo, useState } from 'react';

interface CitationCardState {
  /** Key of the rendered marker occurrence whose popup is open, or `null` when closed. */
  openOwnerKey: string | null;
  /** Per-group active annotation index, keyed by `groupKey`. */
  activeIndexByGroup: Record<string, number>;
}

const initialState: CitationCardState = {
  openOwnerKey: null,
  activeIndexByGroup: {},
};

/**
 * Manages open/close state and per-group active annotation index for citation
 * cards within a single assistant message. The hook carries two distinct key
 * spaces:
 *
 * - Openness (`openPopup`/`closePopup`/`isOpen`) is keyed by **occurrence
 *   owner key** — a stable per-instance id derived by the rendered
 *   `CitationDropdown` (see its `ownerKey`), not by `AnnotationGroup.groupKey`
 *   or `sourceUrl`. Two rendered occurrences resolving to the same group are
 *   therefore always independent popup owners.
 * - The switcher index (`setActiveIndex`/`getActiveIndex`) is keyed by
 *   `groupKey`, because the index indexes into `group.annotations`, which is
 *   group data, not occurrence data.
 */
export const useCitationCard = () => {
  const [state, setState] = useState<CitationCardState>(initialState);

  const openPopup = useCallback((ownerKey: string) => {
    setState((prev) => ({ ...prev, openOwnerKey: ownerKey }));
  }, []);

  const closePopup = useCallback((ownerKey: string) => {
    setState((prev) =>
      prev.openOwnerKey === ownerKey ? { ...prev, openOwnerKey: null } : prev,
    );
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
      isOpen: (ownerKey: string) => state.openOwnerKey === ownerKey,
      getActiveIndex: (groupKey: string) =>
        state.activeIndexByGroup[groupKey] ?? 0,
    }),
    [openPopup, closePopup, setActiveIndex, state],
  );
};
