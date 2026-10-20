import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { useUiFeature } from '../useUiFeature';

/** What the mobile sidebar drawer carries, resolved from the layout keys. */
export interface MobileSidebarContent {
  /** The navigation items, user menu and Usage link (everything `hide-navigation-menu` removes). */
  hasNavigation: boolean;
  /** The conversation list. */
  hasChats: boolean;
  /** Whether the drawer holds anything a user can open and use. */
  isReachable: boolean;
}

/**
 * Resolves what the mobile drawer shows. `hide-navigation-menu` removes the
 * navigation part; the chats block stays reachable when the conversations
 * section and its panel toggle are on, as the earlier conversation drawer was.
 */
export const useMobileSidebarContent = (): MobileSidebarContent => {
  const isNavigationMenuHidden = useUiFeature(
    OverlayFeature.HideNavigationMenu,
  );
  const hasChats = useUiFeature(OverlayFeature.ConversationsSection);
  const isChatsToggleEnabled = useUiFeature(
    OverlayFeature.ConversationsPanelToggle,
  );
  const hasNavigation = !isNavigationMenuHidden;

  return {
    hasNavigation,
    hasChats,
    isReachable: hasNavigation || (hasChats && isChatsToggleEnabled),
  };
};
