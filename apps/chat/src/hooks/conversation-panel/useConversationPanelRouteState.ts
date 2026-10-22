import { useCallback, useEffect, useRef } from 'react';
import { useConversationPanel } from '../../context/ConversationPanelContext';

interface UseConversationPanelRouteStateParams {
  /** Current router pathname; every change closes the attachment canvas. */
  pathname: string;
  isMobile: boolean;
  isCanvasOpen: boolean;
  /** `showConversationsSectionByDefault` — the initial state, not a lock. */
  isOpenByDefault: boolean;
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
 * toggle, and from then on their own choice survives. Only the user's toggle
 * changes it afterwards: neither the page route nor the attachment canvas
 * collapses or expands the sidebar.
 *
 * On a mobile viewport the sidebar is a drawer owned by the app shell, so this
 * state is reset and ignored there.
 */
export const useConversationPanelRouteState = ({
  pathname,
  isMobile,
  isCanvasOpen,
  isOpenByDefault,
  onCloseCanvas,
  onCloseSourcesPanel,
}: UseConversationPanelRouteStateParams): ConversationPanelRouteState => {
  const { isPanelOpen, openPanel, closePanel } = useConversationPanel();

  /* The user's own choice, or `null` while they have made none. */
  const userPanelPreferenceRef = useRef<boolean | null>(null);

  const togglePanel = useCallback(() => {
    userPanelPreferenceRef.current = !isPanelOpen;
    if (isPanelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }, [isPanelOpen, openPanel, closePanel]);

  /* Always close the panel when switching to mobile so a stored desktop `true`
     doesn't bleed through. */
  useEffect(() => {
    if (isMobile) {
      closePanel();
      userPanelPreferenceRef.current = null;
    }
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onCloseCanvas();
  }, [pathname, isOpenByDefault]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Applies the default once the desktop layout is in use, and again if the
     default itself changes — never on navigation. */
  useEffect(() => {
    if (isMobile) return;

    const shouldPanelBeOpen = userPanelPreferenceRef.current ?? isOpenByDefault;
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
