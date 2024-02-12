import { Observable, forkJoin, of } from 'rxjs';

import {
  ApiKeys,
  getConversationApiKey,
  parseConversationApiKey,
} from '@/src/utils/server/api';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { UploadStatus } from '@/src/types/common';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';

import { cleanConversation } from '../../../clean';
import { ConversationService } from '../../conversation-service';
import { ApiEntityStorage } from './api-entity-storage';

import { RootState } from '@/src/store';

export class ConversationApiStorage extends ApiEntityStorage<
  ConversationInfo,
  Conversation
> {
  mergeGetResult(info: ConversationInfo, entity: Conversation): Conversation {
    return {
      ...entity,
      ...info,
      lastActivityDate: info.lastActivityDate ?? entity.lastActivityDate,
      model: entity.model,
    };
  }
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

export const getOrUploadConversation = (
  payload: { id: string },
  state: RootState,
): Observable<{
  conversation: Conversation | null;
  payload: { id: string };
}> => {
  const conversation = ConversationsSelectors.selectConversation(
    state,
    payload.id,
  ) as Conversation;

  if (conversation?.status !== UploadStatus.LOADED) {
    return forkJoin({
      conversation: ConversationService.getConversation(conversation),
      payload: of(payload),
    });
  } else {
    return forkJoin({
      conversation: of(conversation),
      payload: of(payload),
    });
  }
};
