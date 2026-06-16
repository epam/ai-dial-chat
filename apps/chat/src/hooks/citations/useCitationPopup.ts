import { useCallback, useMemo, useState } from 'react';

interface CitationPopupState {
  /** Source URL of the currently open citation popup, or `null` when closed. */
  openGroupSourceUrl: string | null;
  /** Per-group active annotation index, keyed by source URL. */
  activeIndexByGroup: Record<string, number>;
}

const initialState: CitationPopupState = {
  openGroupSourceUrl: null,
  activeIndexByGroup: {},
};

/**
 * Manages open/close state and per-group active annotation index for citation
 * popups within a single assistant message.
 */
export const useCitationPopup = () => {
  const [state, setState] = useState<CitationPopupState>(initialState);

  const openPopup = useCallback((sourceUrl: string) => {
    setState((prev) => ({ ...prev, openGroupSourceUrl: sourceUrl }));
  }, []);

  const closePopup = useCallback(() => {
    setState((prev) => ({ ...prev, openGroupSourceUrl: null }));
  }, []);

  const setActiveIndex = useCallback((sourceUrl: string, index: number) => {
    setState((prev) => ({
      ...prev,
      activeIndexByGroup: { ...prev.activeIndexByGroup, [sourceUrl]: index },
    }));
  }, []);

  return useMemo(
    () => ({
      openPopup,
      closePopup,
      setActiveIndex,
      isOpen: (sourceUrl: string) => state.openGroupSourceUrl === sourceUrl,
      getActiveIndex: (sourceUrl: string) =>
        state.activeIndexByGroup[sourceUrl] ?? 0,
    }),
    [openPopup, closePopup, setActiveIndex, state],
  );
};
