import { Observable, catchError, forkJoin, of } from 'rxjs';

import { cleanConversation } from '@/src/utils/app/clean';
import { prepareEntityName } from '@/src/utils/app/common';
import {
  getGeneratedConversationId,
  regenerateConversationId,
} from '@/src/utils/app/conversation';
import { ConversationService } from '@/src/utils/app/data/conversation-service';
import { ApiEntityStorage } from '@/src/utils/app/data/storages/api/api-entity-storage';
import { constructPath } from '@/src/utils/app/file';
import { getPathToFolderById } from '@/src/utils/app/folders';
import {
  getConversationRootId,
  isRootConversationsId,
} from '@/src/utils/app/id';
import {
  getConversationApiKey,
  parseConversationApiKey,
} from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { ApiKeys } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';

import { RootState } from '@/src/store';
import { ConversationInfo, UploadStatus } from '@epam/ai-dial-shared';

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

  parseEntityKey(key: string): Omit<ConversationInfo, 'folderId' | 'id'> {
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
  );

  if (conversation && conversation?.status !== UploadStatus.LOADED) {
    return forkJoin({
      conversation: ConversationService.getConversation(conversation).pipe(
        catchError((err) => {
          console.error('The conversation was not found:', err);
          return of(null);
        }),
      ),
      payload: of(payload),
    });
  } else {
    return forkJoin({
      conversation: of((conversation as Conversation) ?? null),
      payload: of(payload),
    });
  }
};

export const getPreparedConversations = ({
  conversations,
  conversationsFolders,
}: {
  conversations: Conversation[];
  conversationsFolders: FolderInterface[];
}) =>
  conversations.map((conv) => {
    const { path } = getPathToFolderById(conversationsFolders, conv.folderId, {
      forRenaming: true,
      replaceWithSpacesForRenaming: true,
      trimEndDotsRequired: true,
      prepareNames: true,
    });

    const newName = prepareEntityName(conv.name, {
      forRenaming: true,
      replaceWithSpacesForRenaming: true,
      trimEndDotsRequired: true,
    });

    const folderId = isRootConversationsId(path)
      ? path
      : constructPath(getConversationRootId(), path);

    return regenerateConversationId({
      ...conv,
      name: newName,
      folderId,
    });
  }); // to send conversation with proper parentPath and lastActivityDate order

export const getImportPreparedConversations = ({
  conversations,
  conversationsFolders,
}: {
  conversations: Conversation[] | ConversationInfo[];
  conversationsFolders: FolderInterface[];
}) =>
  conversations.map((conv) => {
    const { path } = getPathToFolderById(conversationsFolders, conv.folderId, {
      forRenaming: false,
      trimEndDotsRequired: true,
      prepareNames: true,
    });

    const newName = prepareEntityName(conv.name);
    const rootId = isRootConversationsId(path) ? path : getConversationRootId();
    const folderId = constructPath(rootId, path);

    return {
      ...conv,
      id: getGeneratedConversationId({
        ...conv,
        name: newName,
        folderId: folderId,
      }),
      name: newName,
      folderId: folderId,
    };
  }); // to send conversation with proper parentPath and lastActivityDate order
