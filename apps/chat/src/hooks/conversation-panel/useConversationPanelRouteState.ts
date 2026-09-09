import { useCallback, useEffect, useRef } from 'react';
import { useConversationPanel } from '../../context/ConversationPanelContext';
import { ROUTES } from '../../types/routes';

interface UseConversationPanelRouteStateParams {
  /** Current router pathname; every change re-evaluates the panel state. */
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

const isConversationSectionRoute = (pathname: string): boolean =>
  pathname === ROUTES.Root ||
  pathname === ROUTES.Conversations ||
  pathname.startsWith(ROUTES.Conversations);

/**
 * Owns when the conversation panel opens and closes as the route changes.
 *
 * `showConversationsSectionByDefault` is an initial-state modifier: it decides
 * the panel state until the user touches the toggle, and from then on their own
 * choice survives every navigation inside the conversation section. Re-applying
 * the default on each navigation is what collapsed a just-opened panel when the
 * user switched chats or started a new one — the regression overlay hosts
 * running the chat full-screen reported.
 *
 * Routes outside the section still force the panel shut, because it would
 * otherwise overlap the catalog, settings and file-manager pages; the
 * preference is kept, so returning to a conversation restores the user's last
 * choice rather than the default.
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
    if (!isConversationSectionRoute(pathname)) {
      closePanel();
      return;
    }
    if (isMobile || isCanvasOpen) return;

    const shouldPanelBeOpen = userPanelPreferenceRef.current ?? isOpenByDefault;
    if (shouldPanelBeOpen) {
      openPanel();
    } else {
      closePanel();
    }
  }, [pathname, isOpenByDefault]); // eslint-disable-line react-hooks/exhaustive-deps

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
