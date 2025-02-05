import { Observable, map } from 'rxjs';

import { ApplicationInfo } from '@/src/types/applications';
import {
  ApiKeys,
  BackendChatEntity,
  BackendChatFolder,
  BackendDataEntity,
  BackendDataNodeType,
  BackendEntity,
  BackendResourceType,
} from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { HTTPMethod } from '@/src/types/http';
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
  ApiUtils,
  parseApplicationApiKey,
  parseConversationApiKey,
} from '../../server/api';
import { constructPath } from '../file';
import { splitEntityId } from '../folders';
import { EnumMapper } from '../mappers';

import { ConversationInfo } from '@epam/ai-dial-shared';
import { contentType } from 'mime-types';

export const getFolderFromShareResult = (
  folder: BackendChatFolder,
  apiKeyType: ApiKeys,
) => {
  const id = ApiUtils.decodeApiUrl(folder.url.slice(0, folder.url.length - 1));
  const { apiKey, bucket, parentPath } = splitEntityId(id);

  return {
    id,
    name: folder.name,
    folderId: constructPath(apiKey, bucket, parentPath),
    type: EnumMapper.getFolderTypeByApiKey(apiKeyType),
    permissions: folder.permissions,
  };
};

export class ShareService {
  public static share(
    shareData: ShareRequestModel,
  ): Observable<ShareByLinkResponseModel> {
    return ApiUtils.request('/api/share/create', {
      method: HTTPMethod.POST,
      body: JSON.stringify(shareData),
    });
  }

  public static shareAccept(
    shareAcceptData: ShareAcceptRequestModel,
  ): Observable<void> {
    return ApiUtils.request('/api/share/accept', {
      method: HTTPMethod.POST,
      body: JSON.stringify(shareAcceptData),
    });
  }

  public static getShareDetails(
    shareAcceptData: ShareAcceptRequestModel,
  ): Observable<InvitationDetails> {
    return ApiUtils.request('/api/share/details', {
      method: HTTPMethod.POST,
      body: JSON.stringify(shareAcceptData),
    });
  }

  public static shareRevoke(resourceUrls: string[]): Observable<void> {
    return ApiUtils.request('/api/share/revoke', {
      method: HTTPMethod.POST,
      body: JSON.stringify({
        resources: resourceUrls.map((url) => ({ url })),
      } as ShareRevokeRequestModel),
    });
  }

  public static shareDiscard(resourceUrls: string[]): Observable<void> {
    return ApiUtils.request('/api/share/discard', {
      method: HTTPMethod.POST,
      body: JSON.stringify({
        resources: resourceUrls.map((url) => ({ url })),
      } as ShareRevokeRequestModel),
    });
  }

  public static getSharedListing(
    sharedListingData: ShareListingRequestModel,
  ): Observable<{
    entities: (
      | ConversationInfo
      | PromptInfo
      | DialFile
      | Omit<ApplicationInfo, 'folderId'>
    )[];
    folders: FolderInterface[];
  }> {
    return ApiUtils.request('/api/share/listing', {
      method: HTTPMethod.POST,
      body: JSON.stringify(sharedListingData),
    }).pipe(
      map((resp: { resources: BackendDataEntity[] }) => {
        const folders: FolderInterface[] = [];
        const entities: (
          | ConversationInfo
          | PromptInfo
          | DialFile
          | Omit<ApplicationInfo, 'folderId'>
        )[] = [];

        resp.resources.forEach((entity) => {
          if (entity.resourceType === BackendResourceType.CONVERSATION) {
            const conversationResource = entity as
              | BackendChatEntity
              | BackendChatFolder;

            if (entity.nodeType === BackendDataNodeType.ITEM) {
              const conversation = conversationResource as BackendChatEntity;
              const id = ApiUtils.decodeApiUrl(conversation.url);

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
              const conversationFolder = getFolderFromShareResult(
                folder,
                ApiKeys.Conversations,
              );
              folders.push(conversationFolder);
            }
          }

          if (entity.resourceType === BackendResourceType.PROMPT) {
            const promptResource = entity as
              | BackendChatEntity
              | BackendChatFolder;

            if (entity.nodeType === BackendDataNodeType.ITEM) {
              const prompt = promptResource as BackendChatEntity;
              const id = ApiUtils.decodeApiUrl(prompt.url);
              const { apiKey, bucket, parentPath } = splitEntityId(id);

              entities.push({
                name: prompt.name,
                id,
                lastActivityDate: prompt.updatedAt,
                folderId: constructPath(apiKey, bucket, parentPath),
              });
            }
            if (entity.nodeType === BackendDataNodeType.FOLDER) {
              const folder = promptResource as BackendChatFolder;
              const promptFolder = getFolderFromShareResult(
                folder,
                ApiKeys.Prompts,
              );
              folders.push(promptFolder);
            }
          }

          if (entity.resourceType === BackendResourceType.FILE) {
            const fileResource = entity as
              | BackendChatEntity
              | BackendChatFolder;
            if (entity.nodeType === BackendDataNodeType.ITEM) {
              const file = fileResource as BackendEntity;
              const id = ApiUtils.decodeApiUrl(file.url);
              const { apiKey, bucket, parentPath } = splitEntityId(id);

              const absolutePath = constructPath(apiKey, bucket, parentPath);
              const mimeType = contentType(file.name);
              entities.push({
                name: file.name,
                id,
                folderId: absolutePath,
                absolutePath: absolutePath,
                contentType: mimeType ? mimeType : 'application/octet-stream',
              });
            }

            if (entity.nodeType === BackendDataNodeType.FOLDER) {
              const folder = fileResource as BackendChatFolder;
              const fileFolder = getFolderFromShareResult(
                folder,
                ApiKeys.Files,
              );
              folders.push(fileFolder);
            }
          }

          if (entity.resourceType === BackendResourceType.APPLICATION) {
            const applicationResource = entity as
              | BackendChatEntity
              | BackendChatFolder;
            if (entity.nodeType === BackendDataNodeType.ITEM) {
              const application = applicationResource as BackendEntity;
              const id = ApiUtils.decodeApiUrl(application.url);

              entities.push({
                name: application.name,
                version: parseApplicationApiKey(application.name).version,
                id,
                permissions: application.permissions,
              });
            }

            if (entity.nodeType === BackendDataNodeType.FOLDER) {
              const folder = applicationResource as BackendChatFolder;
              const fileFolder = getFolderFromShareResult(
                folder,
                ApiKeys.Files,
              );
              folders.push(fileFolder);
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
