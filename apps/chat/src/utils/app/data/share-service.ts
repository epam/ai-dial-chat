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
import { constructPath } from '../file';
import { splitEntityId } from '../folders';

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
  ): Observable<{
    entities: (ConversationInfo | PromptInfo)[];
    folders: FolderInterface[];
  }> {
    return ApiUtils.request(`api/share/listing`, {
      method: 'POST',
      body: JSON.stringify(sharedListingData),
    }).pipe(
      map((resp: { resources: BackendDataEntity[] }) => {
        const folders: FolderInterface[] = [];
        const entities: (ConversationInfo | PromptInfo)[] = [];

        resp.resources.forEach((entity) => {
          if (entity.resourceType === BackendResourceType.CONVERSATION) {
            const conversationResource = entity as
              | BackendChatEntity
              | BackendChatFolder;

            if (entity.nodeType === BackendDataNodeType.ITEM) {
              const conversation = conversationResource as BackendChatEntity;
              const id = decodeURI(
                conversation.url.slice(0, conversation.url.length - 1),
              );
              const { apiKey, bucket, parentPath } = splitEntityId(id);

              entities.push({
                ...parseConversationApiKey(conversation.name),
                id: decodeURI(conversation.url),
                lastActivityDate: conversation.updatedAt,
                folderId: constructPath(apiKey, bucket, parentPath),
              });
            }
            if (entity.nodeType === BackendDataNodeType.FOLDER) {
              const folder = conversationResource as BackendChatFolder;
              const id = decodeURI(folder.url.slice(0, folder.url.length - 1));
              const { apiKey, bucket, parentPath } = splitEntityId(id);

              folders.push({
                id: decodeURI(folder.url.slice(0, folder.url.length - 1)),
                name: folder.name,
                folderId: constructPath(apiKey, bucket, parentPath),
                type: getFolderTypeByApiKey(ApiKeys.Conversations),
              });
            }
          }

          if (entity.resourceType === BackendResourceType.PROMPT) {
            const conversationResource = entity as
              | BackendChatEntity
              | BackendChatFolder;

            if (entity.nodeType === BackendDataNodeType.ITEM) {
              const conversation = conversationResource as BackendChatEntity;
              const id = decodeURI(
                conversation.url.slice(0, conversation.url.length - 1),
              );
              const { apiKey, bucket, parentPath } = splitEntityId(id);

              entities.push({
                ...parsePromptApiKey(conversation.name),
                id: decodeURI(conversation.url),
                lastActivityDate: conversation.updatedAt,
                folderId: constructPath(apiKey, bucket, parentPath),
              });
            }
            if (entity.nodeType === BackendDataNodeType.FOLDER) {
              const folder = conversationResource as BackendChatFolder;
              const id = decodeURI(folder.url.slice(0, folder.url.length - 1));
              const { apiKey, bucket, parentPath } = splitEntityId(id);

              folders.push({
                id: decodeURI(folder.url.slice(0, folder.url.length - 1)),
                name: folder.name,
                folderId: constructPath(apiKey, bucket, parentPath),
                type: getFolderTypeByApiKey(ApiKeys.Prompts),
              });
            }
          }
        });

        return {
          folders,
          entities,
        };
      }),
    );
  }
}
