import { Conversation } from '@/chat/types/chat';

export class ConversationUtil {
  static conversationIdSeparator = '__';

  public static getApiConversationId(conversation: Conversation) {
    const conversationId = `${ConversationUtil.conversationIdSeparator}${conversation.name}`;
    if (conversation.replay.isReplay) {
      return `replay${conversationId}`;
    }
    return `${conversation.model.id}${conversationId}`;
  }
}
