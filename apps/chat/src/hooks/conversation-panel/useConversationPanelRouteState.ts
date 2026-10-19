import { useCallback, useEffect, useRef } from 'react';
import { useConversationPanel } from '../../context/ConversationPanelContext';

interface UseConversationPanelRouteStateParams {
  /** Current router pathname; every change closes the attachment canvas. */
  pathname: string;
  isMobile: boolean;
  isCanvasOpen: boolean;
  /** `showConversationsSectionByDefault` — the initial state, not a lock. */
  isOpenByDefault: boolean;
  /** Whether the user can expand and collapse the sidebar (`conversations-panel-toggle`). Defaults to `true`. */
  isToggleEnabled?: boolean;
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
 * toggle, and from then on their own choice survives. The page route has no say
 * in it, because the sidebar carries the conversation list on every page.
 * Opening the attachment canvas collapses the sidebar and expanding it closes
 * the canvas. Without a toggle the user could never re-expand it, so it then
 * returns to its initial state when the canvas closes.
 *
 * On a mobile viewport the sidebar is a drawer owned by the app shell, so this
 * state is reset and ignored there.
 */
export const useConversationPanelRouteState = ({
  pathname,
  isMobile,
  isCanvasOpen,
  isOpenByDefault,
  isToggleEnabled = true,
  onCloseCanvas,
  onCloseSourcesPanel,
}: UseConversationPanelRouteStateParams): ConversationPanelRouteState => {
  const { isPanelOpen, openPanel, closePanel } = useConversationPanel();

  /* The user's own choice, or `null` while they have made none. */
  const userPanelPreferenceRef = useRef<boolean | null>(null);

  const togglePanel = useCallback(() => {
    if (!isPanelOpen) {
      onCloseCanvas();
    }
    userPanelPreferenceRef.current = !isPanelOpen;
    if (isPanelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }, [isPanelOpen, onCloseCanvas, openPanel, closePanel]);

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
    if (isMobile || isCanvasOpen) return;

    const shouldPanelBeOpen = userPanelPreferenceRef.current ?? isOpenByDefault;
    if (shouldPanelBeOpen) {
      openPanel();
    } else {
      closePanel();
    }
  }, [isMobile, isOpenByDefault]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Without a toggle nothing can re-expand a sidebar the canvas collapsed, so
     it returns to its initial state once the canvas closes. */
  useEffect(() => {
    if (isToggleEnabled || isMobile || isCanvasOpen) return;
    if (isOpenByDefault) {
      openPanel();
    } else {
      closePanel();
    }
  }, [isCanvasOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Safety net for openCanvas call sites that bypass useOpenAttachmentCanvas
     (e.g. citation preview, collapsed stage attachments). */
  useEffect(() => {
    if (isCanvasOpen) {
      closePanel();
      onCloseSourcesPanel();
    }
  }, [isCanvasOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isPanelOpen, closePanel, togglePanel };
};
