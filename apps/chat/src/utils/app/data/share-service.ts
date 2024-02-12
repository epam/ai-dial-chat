import { Observable, map } from 'rxjs';

import { ConversationInfo } from '@/src/types/chat';
import {
  BackendChatEntity,
  BackendChatFolder,
  BackendDataEntity,
  BackendDataNodeType,
  BackendResourceType,
} from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { PromptInfo } from '@/src/types/prompt';
import {
  ShareAcceptRequestModel,
  ShareByLinkResponseModel,
  ShareListingRequestModel,
  ShareRequestModel,
} from '@/src/types/share';

import {
  ApiKeys,
  ApiUtils,
  getFolderTypeByApiKey,
  parseConversationApiKey,
  parsePromptApiKey,
} from '../../server/api';

export class ShareService {
  public static share(
    shareData: ShareRequestModel,
  ): Observable<ShareByLinkResponseModel> {
    return ApiUtils.request(`api/share/create`, {
      method: 'POST',
      body: JSON.stringify(shareData),
    });
  }
  public static shareAccept(
    shareAcceptData: ShareAcceptRequestModel,
  ): Observable<void> {
    return ApiUtils.request(`api/share/accept`, {
      method: 'POST',
      body: JSON.stringify(shareAcceptData),
    });
  }
  public static getSharedListing(
    sharedListingData: ShareListingRequestModel,
  ): Observable<(ConversationInfo | PromptInfo)[]> {
    return ApiUtils.request(`api/share/listing`, {
      method: 'POST',
      body: JSON.stringify(sharedListingData),
    }).pipe(
      map((resp: { resources: BackendDataEntity[] }) => {
        return resp.resources.map(
          (entity): ConversationInfo | PromptInfo | FolderInterface => {
            if (entity.resourceType === BackendResourceType.CONVERSATION) {
              const conversationResource = entity as
                | BackendChatEntity
                | BackendChatFolder;

              if (entity.nodeType === BackendDataNodeType.ITEM) {
                const conversation = conversationResource as BackendChatEntity;
                const relativePath =
                  conversationResource.parentPath || undefined;

                return {
                  ...parseConversationApiKey(conversation.name),
                  id: decodeURI(conversation.url),
                  lastActivityDate: conversation.updatedAt,
                  folderId: relativePath,
                };
              }
              if (entity.nodeType === BackendDataNodeType.FOLDER) {
                const folder = conversationResource as BackendChatFolder;
                const relativePath =
                  conversationResource.parentPath || undefined;

                return {
                  id: decodeURI(folder.url),
                  name: folder.name,
                  folderId: relativePath,
                  type: getFolderTypeByApiKey(ApiKeys.Conversations),
                };
              }
            }

            if (entity.resourceType === BackendResourceType.PROMPT) {
              const conversationResource = entity as
                | BackendChatEntity
                | BackendChatFolder;

              if (entity.nodeType === BackendDataNodeType.ITEM) {
                const conversation = conversationResource as BackendChatEntity;
                const relativePath =
                  conversationResource.parentPath || undefined;

                return {
                  ...parsePromptApiKey(conversation.name),
                  id: decodeURI(conversation.url),
                  lastActivityDate: conversation.updatedAt,
                  folderId: relativePath,
                };
              }
              if (entity.nodeType === BackendDataNodeType.FOLDER) {
                const folder = conversationResource as BackendChatFolder;
                const relativePath =
                  conversationResource.parentPath || undefined;

                return {
                  id: decodeURI(folder.url),
                  name: folder.name,
                  folderId: relativePath,
                  type: getFolderTypeByApiKey(ApiKeys.Prompts),
                };
              }
            }
            return entity;
          },
        );
      }),
    );
  }
}
