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
  InvitationDetails,
  ShareAcceptRequestModel,
  ShareByLinkResponseModel,
  ShareListingRequestModel,
  ShareRequestModel,
  ShareRevokeRequestModel,
} from '@/src/types/share';

import {
  ApiKeys,
  ApiUtils,
  decodeApiUrl,
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

  public static getShareDetails(
    shareAcceptData: ShareAcceptRequestModel,
  ): Observable<InvitationDetails> {
    return ApiUtils.request(`api/share/accept`, {
      method: 'POST',
      body: JSON.stringify({ ...shareAcceptData, withAccept: false }),
    });
  }

  public static shareRevoke(resourceUrls: string[]): Observable<void> {
    return ApiUtils.request(`api/share/revoke`, {
      method: 'POST',
      body: JSON.stringify({
        resources: resourceUrls.map((url) => ({ url })),
      } as ShareRevokeRequestModel),
    });
  }

  public static shareDiscard(resourceUrls: string[]): Observable<void> {
    return ApiUtils.request(`api/share/discard`, {
      method: 'POST',
      body: JSON.stringify({
        resources: resourceUrls.map((url) => ({ url })),
      } as ShareRevokeRequestModel),
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
              const id = decodeApiUrl(conversation.url);

              const { apiKey, bucket, parentPath } = splitEntityId(id);

              entities.push({
                ...parseConversationApiKey(conversation.name),
                id,
                lastActivityDate: conversation.updatedAt,
                folderId: constructPath(apiKey, bucket, parentPath),
              });
            }
            if (entity.nodeType === BackendDataNodeType.FOLDER) {
              const folder = conversationResource as BackendChatFolder;
              const id = decodeApiUrl(
                folder.url.slice(0, folder.url.length - 1),
              );
              const { apiKey, bucket, parentPath } = splitEntityId(id);

              folders.push({
                id,
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
              const id = decodeApiUrl(conversation.url);
              const { apiKey, bucket, parentPath } = splitEntityId(id);

              entities.push({
                ...parsePromptApiKey(conversation.name),
                id,
                lastActivityDate: conversation.updatedAt,
                folderId: constructPath(apiKey, bucket, parentPath),
              });
            }
            if (entity.nodeType === BackendDataNodeType.FOLDER) {
              const folder = conversationResource as BackendChatFolder;
              const id = decodeApiUrl(
                folder.url.slice(0, folder.url.length - 1),
              );
              const { apiKey, bucket, parentPath } = splitEntityId(id);

              folders.push({
                id,
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
