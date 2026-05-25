import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  from,
  of,
  switchMap,
  throwError,
} from 'rxjs';

import {
  getStorageSafeUniqueConversationName,
  regenerateConversationId,
} from '@/src/utils/app/conversation';
import { ApiEntityStorage } from '@/src/utils/app/data/storages/api/api-entity-storage';
import {
  getStorageSafeUniquePromptName,
  regeneratePromptId,
} from '@/src/utils/app/prompts';
import {
  ApiUtils,
  getOpsApiUrl,
  parseEntityApiKey,
} from '@/src/utils/server/api';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  ApplicationInfo,
  ApplicationLogsType,
  CustomApplicationModel,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { Conversation } from '@/src/types/chat';
import {
  BackendChatEntity,
  BackendResourceType,
  MoveModel,
} from '@/src/types/common';
import { FileOperationsResult } from '@/src/types/files';
import { FolderInterface, FoldersAndEntities } from '@/src/types/folder';
import { HTTPMethod } from '@/src/types/http';
import { AgentUsageStats } from '@/src/types/models';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { ServerSlugs } from '@/src/types/slugs-types';
import { DialStorage } from '@/src/types/storage';
import { ToolsetInfo, ToolsetModel } from '@/src/types/toolsets';

import { ApplicationApiStorage } from './api/application-api-storage';
import { ConversationApiStorage } from './api/conversation-api-storage';
import { PromptApiStorage } from './api/prompt-api-storage';
import { ToolsetApiStorage } from './api/toolset-api-storage';

import {
  ConversationInfo,
  Entity,
  MessageFormSchema,
} from '@epam/ai-dial-shared';
import { DialCopiedItem } from '@epam/ai-dial-ui-kit';

const MAX_RETRIES_COUNT = 3;

export class ApiStorage implements DialStorage {
  private _conversationApiStorage = new ConversationApiStorage();
  private _promptApiStorage = new PromptApiStorage();
  private _applicationApiStorage = new ApplicationApiStorage();
  private _toolsetApiStorage = new ToolsetApiStorage();

  private tryCreateEntity<
    TInfo extends Entity,
    TEntity extends TInfo & (Conversation | Prompt),
  >(
    entity: TEntity,
    siblingEntities: Pick<Entity, 'name' | 'folderId'>[],
    apiStorage: ApiEntityStorage<TInfo, TEntity>,
    entityType: BackendResourceType,
    loadSiblingEntities: (
      folderId?: string,
    ) => Observable<Pick<Entity, 'name' | 'folderId'>[]> = () =>
      of(siblingEntities),
  ): Observable<TInfo> {
    let retries = 0;

    const retry = (
      entity: TEntity,
      currentSiblingEntities: Pick<Entity, 'name' | 'folderId'>[],
      apiStorage: ApiEntityStorage<TInfo, TEntity>,
    ): Observable<TInfo> =>
      apiStorage.createEntity(entity).pipe(
        catchError((err) => {
          if (retries < MAX_RETRIES_COUNT) {
            retries++;

            return loadSiblingEntities(entity.folderId).pipe(
              switchMap((reloadedSiblingEntities) => {
                const siblings = reloadedSiblingEntities.length
                  ? reloadedSiblingEntities
                  : currentSiblingEntities;
                const existingNames = siblings
                  .filter((item) => item.folderId === entity.folderId)
                  .map((item) => item.name);
                const newName =
                  entityType === BackendResourceType.CONVERSATION
                    ? getStorageSafeUniqueConversationName({
                        conversation: entity as Conversation,
                        desiredName: entity.name,
                        existingNames,
                      })
                    : getStorageSafeUniquePromptName({
                        prompt: entity as Prompt,
                        desiredName: entity.name,
                        existingNames,
                      });

                const updatedEntity = {
                  ...entity,
                  name: newName,
                };

                const updatedEntityWithRegeneratedId =
                  entityType === BackendResourceType.CONVERSATION
                    ? regenerateConversationId(updatedEntity as Conversation)
                    : regeneratePromptId(updatedEntity as Prompt);

                return retry(
                  updatedEntityWithRegeneratedId as TEntity,
                  siblings,
                  apiStorage,
                );
              }),
            );
          }

          return throwError(() => err);
        }),
      );

    return retry(entity, siblingEntities, apiStorage);
  }

  getConversationsFolders(path?: string): Observable<FolderInterface[]> {
    return this._conversationApiStorage.getFolders(path);
  }

  setConversationsFolders(_folders: FolderInterface[]): Observable<void> {
    return EMPTY; // don't need to save folders
  }

  getPromptsFolders(path?: string): Observable<FolderInterface[]> {
    return this._promptApiStorage.getFolders(path);
  }

  setPromptsFolders(_folders: FolderInterface[]): Observable<void> {
    return EMPTY; // don't need to save folders
  }

  getConversationsAndFolders(
    path?: string,
  ): Observable<FoldersAndEntities<ConversationInfo>> {
    return this._conversationApiStorage.getFoldersAndEntities(path);
  }

  getConversations(
    path?: string,
    recursive?: boolean,
  ): Observable<ConversationInfo[]> {
    return this._conversationApiStorage.getEntities(path, recursive);
  }

  getMultipleFoldersConversations(
    paths: string[],
    recursive?: boolean,
  ): Observable<ConversationInfo[]> {
    return this._conversationApiStorage.getMultipleFoldersEntities(
      paths,
      recursive,
    );
  }

  getConversation(info: ConversationInfo): Observable<Conversation | null> {
    return this._conversationApiStorage.getEntity(info);
  }

  getConversationMetadata(id: string): Observable<BackendChatEntity | null> {
    return this._conversationApiStorage.getEntityMetadata(id);
  }

  createConversation(
    conversation: Conversation,
  ): Observable<ConversationInfo | null> {
    return this._conversationApiStorage.createEntity(conversation).pipe(
      catchError(() => {
        return this.getConversations(conversation.folderId).pipe(
          switchMap((conversations) =>
            this.tryCreateEntity(
              conversation,
              conversations,
              this._conversationApiStorage,
              BackendResourceType.CONVERSATION,
              (folderId) => this.getConversations(folderId),
            ),
          ),
          switchMap((conversation) => this.getConversation(conversation)),
        );
      }),
    );
  }

  updateConversation(conversation: Conversation): Observable<ConversationInfo> {
    return this._conversationApiStorage.updateEntity(conversation);
  }

  deleteConversation(info: ConversationInfo): Observable<void> {
    return this._conversationApiStorage.deleteEntity(info);
  }

  setConversations(
    conversations: Conversation[],
  ): Observable<ConversationInfo> {
    return from(conversations).pipe(
      concatMap((conv) =>
        this.getConversations(conv.folderId).pipe(
          concatMap((apiConversations) =>
            this.tryCreateEntity(
              conv,
              [...conversations, ...apiConversations],
              this._conversationApiStorage,
              BackendResourceType.CONVERSATION,
              (folderId) => this.getConversations(folderId),
            ),
          ),
        ),
      ),
    );
  }

  getPromptsAndFolders(path?: string): Observable<FoldersAndEntities<Entity>> {
    return this._promptApiStorage.getFoldersAndEntities(path);
  }

  getPrompts(path?: string, recursive?: boolean): Observable<Prompt[]> {
    return this._promptApiStorage.getEntities(path, recursive);
  }

  getMultipleFoldersPrompts(
    paths: string[],
    recursive?: boolean,
  ): Observable<Prompt[]> {
    return this._promptApiStorage.getMultipleFoldersEntities(paths, recursive);
  }

  getPrompt(info: PromptInfo): Observable<Prompt | null> {
    return this._promptApiStorage.getEntity(info);
  }

  getPromptMetadata(id: string): Observable<BackendChatEntity | null> {
    return this._promptApiStorage.getEntityMetadata(id);
  }

  createPrompt(prompt: Prompt): Observable<PromptInfo | null> {
    return this._promptApiStorage.createEntity(prompt).pipe(
      catchError(() => {
        return this.getPrompts(prompt.folderId).pipe(
          switchMap((prompts) =>
            this.tryCreateEntity(
              prompt,
              prompts,
              this._promptApiStorage,
              BackendResourceType.PROMPT,
              (folderId) => this.getPrompts(folderId),
            ),
          ),
          switchMap((prompt) => this.getPrompt(prompt)),
        );
      }),
    );
  }

  updatePrompt(prompt: Prompt): Observable<PromptInfo> {
    return this._promptApiStorage.updateEntity(prompt);
  }

  deletePrompt(info: Entity): Observable<void> {
    return this._promptApiStorage.deleteEntity(info);
  }

  setPrompts(prompts: Prompt[]): Observable<PromptInfo> {
    return from(prompts).pipe(
      concatMap((prompt) =>
        this.getPrompts(prompt.folderId).pipe(
          concatMap((apiPrompts) =>
            this.tryCreateEntity(
              prompt,
              [...prompts, ...apiPrompts],
              this._promptApiStorage,
              BackendResourceType.PROMPT,
              (folderId) => this.getPrompts(folderId) as Observable<Prompt[]>,
            ),
          ),
        ),
      ),
    );
  }

  move(data: MoveModel): Observable<MoveModel> {
    return ApiUtils.request(getOpsApiUrl(ServerSlugs.RESOURCE_MOVE), {
      method: HTTPMethod.POST,
      body: JSON.stringify({
        sourceUrl: ApiUtils.encodeApiUrl(data.sourceUrl),
        destinationUrl: ApiUtils.encodeApiUrl(data.destinationUrl),
        overwrite: data.overwrite,
      }),
    });
  }

  copyFiles(
    data: {
      files: DialCopiedItem[];
    },
    options?: { signal?: AbortSignal | null },
  ): Observable<FileOperationsResult<MoveModel>> {
    return ApiUtils.request('/api/files/copy', {
      method: HTTPMethod.POST,
      body: JSON.stringify(data),
      signal: options?.signal,
    });
  }

  moveFiles(
    data: {
      files: DialCopiedItem[];
    },
    options?: { signal?: AbortSignal | null },
  ): Observable<FileOperationsResult<MoveModel>> {
    return ApiUtils.request('/api/files/move', {
      method: HTTPMethod.POST,
      body: JSON.stringify(data),
      signal: options?.signal,
    });
  }

  deleteFiles(data: {
    files: DialCopiedItem[];
  }): Observable<FileOperationsResult<string>> {
    return ApiUtils.request('/api/files/delete', {
      method: HTTPMethod.POST,
      body: JSON.stringify(data),
    });
  }

  uploadArchive(data: {
    file: File;
    destinationUrl: string;
  }): Observable<void> {
    const encodedDestination = encodeURIComponent(data.destinationUrl);

    return from(
      fetch(`/api/files/upload-archive?destination=${encodedDestination}`, {
        method: HTTPMethod.POST,
        body: data.file,
      }).then((response) => {
        if (!response.ok) {
          return response.text().then((text) => {
            const message = text || 'Failed to upload archive';
            throw new Error(message);
          });
        }

        return undefined;
      }),
    );
  }

  createApplication(
    application: CustomApplicationModel,
    schema: ApiDetailedApplicationTypeSchema,
  ): Observable<ApplicationInfo> {
    return this._applicationApiStorage.createEntity(application, schema);
  }

  updateApplication(
    application: CustomApplicationModel,
    schema?: ApiDetailedApplicationTypeSchema,
  ): Observable<ApplicationInfo> {
    return this._applicationApiStorage.updateEntity(application, schema);
  }

  getApplication(
    applicationId: string,
  ): Observable<CustomApplicationModel | null> {
    return this._applicationApiStorage.getEntity({
      id: applicationId,
      folderId: '',
      ...parseEntityApiKey(applicationId, { parseVersion: true }),
    });
  }

  getApplications(
    path?: string,
    recursive?: boolean,
  ): Observable<ApplicationInfo[]> {
    return this._applicationApiStorage.getEntities(path, recursive);
  }

  deleteApplication(applicationId: string): Observable<void> {
    return this._applicationApiStorage.deleteEntity({
      id: applicationId,
      folderId: '',
      ...parseEntityApiKey(applicationId, { parseVersion: true }),
    });
  }

  deployApplication(applicationId: string): Observable<void> {
    return this._applicationApiStorage.toggleApplicationStatus(
      applicationId,
      SimpleApplicationStatus.DEPLOY,
    );
  }

  redeployApplication(applicationId: string): Observable<void> {
    return this._applicationApiStorage.toggleApplicationStatus(
      applicationId,
      SimpleApplicationStatus.REDEPLOY,
    );
  }

  undeployApplication(applicationId: string): Observable<void> {
    return this._applicationApiStorage.toggleApplicationStatus(
      applicationId,
      SimpleApplicationStatus.UNDEPLOY,
    );
  }

  getApplicationLogs(path: string): Observable<ApplicationLogsType> {
    return this._applicationApiStorage.getLogs(path);
  }

  getApplicationConfig(applicationId: string): Observable<MessageFormSchema> {
    return this._applicationApiStorage.getConfigurationSchema(applicationId);
  }

  getAgentLimits(id: string): Observable<AgentUsageStats> {
    return this._applicationApiStorage.getAgentLimits(id);
  }

  // Toolsets
  getToolsetById(toolsetId: string): Observable<ToolsetModel | null> {
    return this._toolsetApiStorage.getEntity({
      id: toolsetId,
      //TODO: add folderId to toolsets when folders for toolsets are implemented
      folderId: '',
      ...parseEntityApiKey(toolsetId, { parseVersion: true }),
    });
  }

  createToolset(data: ToolsetModel): Observable<ToolsetInfo> {
    return this._toolsetApiStorage.createEntity(data);
  }

  updateToolset(data: ToolsetModel): Observable<ToolsetInfo> {
    return this._toolsetApiStorage.updateEntity(data);
  }

  getToolsetsByPath(path: string): Observable<ToolsetInfo[]> {
    return this._toolsetApiStorage.getEntities(path, true);
  }

  deleteToolset(toolsetId: string): Observable<void> {
    return this._toolsetApiStorage.deleteEntity({
      id: toolsetId,
      //TODO: add folderId to toolsets when folders for toolsets are implemented
      folderId: '',
      ...parseEntityApiKey(toolsetId, { parseVersion: true }),
    });
  }
}
