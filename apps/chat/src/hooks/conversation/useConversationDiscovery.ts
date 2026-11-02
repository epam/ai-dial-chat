import { useConversationDiscovery as useDiscovery } from '@epam/ai-dial-chat-hooks/conversation';
import { toPanelConversationId } from '../../utils/conversation-id-match';

/** Keeps expected chats discoverable for the current conversations provider. */
export const useConversationDiscovery = (
  conversations: readonly { id: string }[],
  refresh: () => Promise<void>,
  userSub: string | undefined,
): ((expectedIds?: readonly string[]) => Promise<void>) =>
  useDiscovery({
    items: conversations,
    refresh,
    sessionKey: userSub,
    normalizeId: toPanelConversationId,
  });
