import { Observable, forkJoin, of } from 'rxjs';

import { getRootId } from '@/src/utils/app/id';
import {
  ApiKeys,
  getConversationApiKey,
  parseConversationApiKey,
} from '@/src/utils/server/api';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { UploadStatus } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';

import { cleanConversation } from '../../../clean';
import { getGeneratedConversationId } from '../../../conversation';
import { constructPath, notAllowedSymbolsRegex } from '../../../file';
import { getPathToFolderById } from '../../../folders';
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

  parseEntityKey(key: string): Omit<ConversationInfo, 'folderId'> {
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

export const getPreparedConversations = ({
  conversations,
  conversationsFolders,
  addRoot = false,
}: {
  conversations: Conversation[];
  conversationsFolders: FolderInterface[];
  addRoot?: boolean;
}) =>
  conversations.map((conv) => {
    const { path } = getPathToFolderById(
      conversationsFolders,
      conv.folderId,
      true,
    );

    const newName = conv.name.replace(notAllowedSymbolsRegex, '');

    return {
      ...conv,
      id: getGeneratedConversationId({
        ...conv,
        name: newName,
        folderId: path,
      }),
      name: newName,
      folderId: addRoot
        ? constructPath(getRootId({ apiKey: ApiKeys.Conversations }), path)
        : path,
    };
  }); // to send conversation with proper parentPath and lastActivityDate order
