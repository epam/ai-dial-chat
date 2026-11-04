import { useCallback, useEffect } from 'react';
import { useConversationPanel } from '../../context/ConversationPanelContext';
import { StorageKey } from '../../types/storage-key';
import useLocalStorage from '../useLocalStorage';

interface UseConversationPanelRouteStateParams {
  /** Current router pathname; every change closes the attachment canvas. */
  pathname: string;
  isMobile: boolean;
  isCanvasOpen: boolean;
  /** `showConversationsSectionByDefault` — the initial state, not a lock. */
  isOpenByDefault: boolean;
  /**
   * `conversations-panel-toggle`. When `false` no toggle renders, so the
   * stored choice is ignored and the sidebar keeps its default state.
   */
  isToggleEnabled: boolean;
  onCloseCanvas: () => void;
  onCloseSourcesPanel: () => void;
}

interface ConversationPanelRouteState {
  isPanelOpen: boolean;
  closePanel: () => void;
  togglePanel: () => void;
}

/**
 * Owns the desktop sidebar's expanded state.
 *
 * `isPanelOpen` means "expanded". `showConversationsSectionByDefault` is an
 * initial-state modifier: it decides the state until the user touches the
 * toggle. The user's own choice is stored in `localStorage` under
 * `StorageKey.NavigationSidebarExpanded`, so it survives navigation and
 * reloads; only the toggle writes it. When storage is unavailable the choice
 * lasts for the page session. Neither the page route nor the attachment canvas
 * collapses or expands the sidebar.
 *
 * On a mobile viewport the sidebar is a drawer owned by the app shell, so this
 * state is reset and ignored there; the stored choice is kept and applied again
 * when the desktop layout returns.
 */
export const useConversationPanelRouteState = ({
  pathname,
  isMobile,
  isCanvasOpen,
  isOpenByDefault,
  isToggleEnabled,
  onCloseCanvas,
  onCloseSourcesPanel,
}: UseConversationPanelRouteStateParams): ConversationPanelRouteState => {
  const { isPanelOpen, openPanel, closePanel } = useConversationPanel();

  /* The user's own choice, or `null` while they have made none. */
  const [storedPreference, setStoredPreference] = useLocalStorage<
    boolean | null
  >(StorageKey.NavigationSidebarExpanded, null);
  const userPanelPreference =
    isToggleEnabled && typeof storedPreference === 'boolean'
      ? storedPreference
      : null;

  const togglePanel = useCallback(() => {
    setStoredPreference(!isPanelOpen);
    if (isPanelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }, [isPanelOpen, openPanel, closePanel, setStoredPreference]);

  /* Always close the panel when switching to mobile so a desktop `true`
     doesn't bleed through into the drawer. */
  useEffect(() => {
    if (isMobile) {
      closePanel();
    }
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onCloseCanvas();
  }, [pathname, isOpenByDefault]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Applies the stored choice, or the default, once the desktop layout is in
     use, and again if the default itself changes — never on navigation. */
  useEffect(() => {
    if (isMobile) return;

    const shouldPanelBeOpen = userPanelPreference ?? isOpenByDefault;
    if (shouldPanelBeOpen) {
      openPanel();
    } else {
      closePanel();
    }
  }, [isMobile, isOpenByDefault]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The canvas and the sources panel share the end edge, so whichever opens
     replaces the other — including openCanvas call sites that bypass
     useOpenAttachmentCanvas (e.g. citation preview, collapsed stage
     attachments). */
  useEffect(() => {
    if (isCanvasOpen) {
      onCloseSourcesPanel();
    }
  }, [isCanvasOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isPanelOpen, closePanel, togglePanel };
};
