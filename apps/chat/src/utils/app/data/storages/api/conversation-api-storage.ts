import {
  ApiKeys,
  getConversationApiKey,
  parseConversationApiKey,
} from '@/src/utils/server/api';

import { Conversation, ConversationInfo } from '@/src/types/chat';

import { cleanConversation } from '../../../clean';
import { ApiEntityStorage } from './api-entity-storage';

export class ConversationApiStorage extends ApiEntityStorage<
  ConversationInfo,
  Conversation
> {
  cleanUpEntity(conversation: Conversation): Conversation {
    return cleanConversation(conversation);
  }
  getEntityKey(info: ConversationInfo): string {
    return getConversationApiKey(info);
  }
  parseEntityKey(key: string): ConversationInfo {
    return parseConversationApiKey(key);
  }
  getStorageKey(): ApiKeys {
    return ApiKeys.Conversations;
  }
}
