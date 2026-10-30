import type { Conversation } from '@epam/ai-dial-chat-shared';
import { useHtmlTagAnnotationGroups } from '@epam/ai-dial-quotations';
/** Extracts persisted annotations for the shared defensive grouping hook. */
export const useConversationAnnotationPool = (
  conversation: Conversation | null | undefined,
) => useHtmlTagAnnotationGroups(conversation?.customViewState?.['annotations']);
