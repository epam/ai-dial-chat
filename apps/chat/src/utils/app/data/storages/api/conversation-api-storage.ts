import { Observable, catchError, forkJoin, of } from 'rxjs';

import { cleanConversation } from '@/src/utils/app/clean';
import {
  getDefaultConversationProps,
  prepareEntityName,
} from '@/src/utils/app/common';
import {
  getConversationInfoFromId,
  getGeneratedConversationId,
  regenerateConversationId,
} from '@/src/utils/app/conversation';
import { ConversationService } from '@/src/utils/app/data/conversation-service';
import { ApiEntityStorage } from '@/src/utils/app/data/storages/api/api-entity-storage';
import { constructPath } from '@/src/utils/app/file';
import { getPathToFolderById } from '@/src/utils/app/folders';
import {
  getConversationRootId,
  isEntityIdExternal,
  isEntityIdLocal,
  isRootConversationsId,
} from '@/src/utils/app/id';
import {
  getConversationApiKey,
  parseConversationApiKey,
} from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { ApiKeys } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { RootState } from '@/src/types/store';

import { ConversationsSelectors } from '@/src/store/selectors';

import { ConversationInfo, UploadStatus } from '@epam/ai-dial-shared';

export class ConversationApiStorage extends ApiEntityStorage<
  ConversationInfo,
  Conversation
> {
  mergeGetResult(info: ConversationInfo, entity: Conversation): Conversation {
    return {
      ...entity,
      ...info,
      updatedAt: info.updatedAt ?? entity.updatedAt,
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

export const getOrUploadConversation = <T extends { id: string }>(
  payload: T,
  state: RootState,
): Observable<{
  conversation: Conversation | null;
  payload: T;
  wasUploaded: boolean;
}> => {
  let conversation = ConversationsSelectors.selectConversation(
    state,
    payload.id,
  );

  if (!conversation && isEntityIdExternal({ id: payload.id })) {
    conversation = getConversationInfoFromId(payload.id);
  }

  if (
    conversation &&
    conversation?.status !== UploadStatus.LOADED &&
    !isEntityIdLocal(conversation)
  ) {
    return forkJoin({
      conversation: ConversationService.getConversation(conversation).pipe(
        catchError((err) => {
          console.error('The conversation was not found:', err);
          return of(null);
        }),
      ),
      payload: of(payload),
      wasUploaded: of(true),
    });
  } else {
    return of({
      conversation: (conversation as Conversation) ?? null,
      payload: payload,
      wasUploaded: false,
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
  }); // to send conversation with proper parentPath and updatedAt order

export const getImportPreparedConversations = ({
  conversations,
  conversationsFolders,
}: {
  conversations: Conversation[];
  conversationsFolders: FolderInterface[];
}): Conversation[] =>
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
      ...getDefaultConversationProps(),
      id: getGeneratedConversationId({
        ...conv,
        name: newName,
        folderId: folderId,
      }),
      name: newName,
      folderId: folderId,
    };
  }); // to send conversation with proper parentPath and updatedAt order
