import { Observable } from 'rxjs';

import { Conversation } from '@/src/types/chat';
import { AgentUsageStats } from '@/src/types/models';

import { ApiDetailedApplicationTypeSchema } from './application-type-schema';
import {
  ApplicationInfo,
  ApplicationLogsType,
  CustomApplicationModel,
} from './applications';
import { BackendChatEntity, MoveModel } from './common';
import { FileOperationsResult } from './files';
import { FolderInterface, FoldersAndEntities } from './folder';
import { Prompt, PromptInfo } from './prompt';
import { ToolsetInfo, ToolsetModel } from './toolsets';

import {
  ConversationInfo,
  Entity,
  MessageFormSchema,
} from '@epam/ai-dial-shared';
import { DialCopiedItem, DialDeletedItem } from '@epam/ai-dial-ui-kit';

export enum StorageType {
  BrowserStorage = 'browserStorage',
  API = 'api',
}

export enum UIStorageKeys {
  Prompts = 'prompts',
  ConversationHistory = 'conversationHistory',
  Folders = 'folders',
  SelectedConversationIds = 'selectedConversationIds',
  SelectedPublicationId = 'selectedPublicationId',
  RecentModelsIds = 'recentModelsIds',
  Settings = 'settings',
  ShowChatbar = 'showChatbar',
  ShowPromptbar = 'showPromptbar',
  ShowMarketplaceFilterbar = 'showMarketplaceFilterbar',
  ChatbarWidth = 'chatbarWidth',
  PromptbarWidth = 'promptbarWidth',
  MarketplaceFilterbarWidth = 'marketplaceFilterbarWidth',
  IsChatFullWidth = 'isChatFullWidth',
  OpenedFoldersIds = 'openedFoldersIds',
  OpenedConversationFoldersIds = 'openedConversationFoldersIds',
  OpenedPromptFoldersIds = 'openedPromptFoldersIds',
  TextOfClosedAnnouncement = 'textOfClosedAnnouncement',
  CustomLogo = 'customLogo',
  ChatCollapsedSections = 'chatCollapsedSections',
  PromptCollapsedSections = 'promptCollapsedSections',
  FileCollapsedSections = 'fileCollapsedSections',
  LastConversationSettings = 'lastConversationSettings',
  SelectedWidget = 'selectedWidget',
  DefaultModelReference = 'defaultModelReference',
  EnterType = 'enterType',
  AgentsFilterPanelCollapseState = 'agentsFilterPanelCollapseState',
  ToolsetFilterPanelCollapseState = 'toolsetFilterPanelCollapseState',
  FileSizeCache = 'dialFilesSizeCache',
}

export enum MigrationStorageKeys {
  MigratedConversationIds = 'migratedConversationIds',
  MigratedPromptIds = 'migratedPromptIds',
  FailedMigratedConversationIds = 'failedMigratedConversationIds',
  FailedMigratedPromptIds = 'failedMigratedPromptIds',
  ChatsBackedUp = 'chatsBackedUp',
  PromptsBackedUp = 'promptsBackedUp',
  MigrationInitialized = 'migrationInitialized',
}

export interface EntityStorage<
  TEntityInfo extends Omit<Entity, 'name'> & {
    name: string | Record<string, string>;
  },
  TEntity extends TEntityInfo,
> {
  getFolders(path?: string): Observable<FolderInterface[]>; // listing with short information

  getEntities(path?: string, recursive?: boolean): Observable<TEntityInfo[]>; // listing with short information

  getMultipleFoldersEntities(
    paths: string[],
    recursive?: boolean,
  ): Observable<TEntityInfo[]>; // listing with short information from multiple folders

  getFoldersAndEntities(
    path?: string,
  ): Observable<FoldersAndEntities<TEntityInfo>>;

  getEntity(info: TEntityInfo): Observable<TEntity | null>;

  createEntity(entity: TEntity): Observable<TEntityInfo>;

  updateEntity(entity: TEntity): Observable<TEntityInfo>;

  deleteEntity(info: TEntityInfo): Observable<void>;

  getEntityKey(info: TEntityInfo): string;

  parseEntityKey(key: string): Omit<TEntityInfo, 'folderId' | 'id'>;

  getStorageKey(): string; // e.g. ApiKeys or `conversationHistory`/`prompts` in case of localStorage
}

export interface DialStorage {
  getConversationsFolders(path?: string): Observable<FolderInterface[]>;

  setConversationsFolders(folders: FolderInterface[]): Observable<void>;

  getPromptsFolders(): Observable<FolderInterface[]>;

  setPromptsFolders(folders: FolderInterface[]): Observable<void>;

  getConversationsAndFolders(
    path?: string,
  ): Observable<FoldersAndEntities<ConversationInfo>>;

  getConversations(
    path?: string,
    recursive?: boolean,
  ): Observable<ConversationInfo[]>;

  getMultipleFoldersConversations(
    paths: string[],
    recursive?: boolean,
  ): Observable<ConversationInfo[]>;

  getConversation(info: ConversationInfo): Observable<Conversation | null>;

  getConversationMetadata(id: string): Observable<BackendChatEntity | null>;

  createConversation(
    conversation: Conversation,
  ): Observable<ConversationInfo | null>;

  updateConversation(
    conversation: Conversation,
  ): Observable<ConversationInfo | void>;

  deleteConversation(info: ConversationInfo): Observable<void>;

  setConversations(conversations: Conversation[]): Observable<ConversationInfo>;

  getPromptsAndFolders(
    path?: string,
  ): Observable<FoldersAndEntities<PromptInfo>>;

  getPrompts(path?: string, recursive?: boolean): Observable<PromptInfo[]>;

  getMultipleFoldersPrompts(
    paths: string[],
    recursive?: boolean,
  ): Observable<PromptInfo[]>;

  getPrompt(info: PromptInfo): Observable<Prompt | null>;

  getPromptMetadata(id: string): Observable<BackendChatEntity | null>;

  createPrompt(prompt: Prompt): Observable<PromptInfo | null>;

  updatePrompt(prompt: Prompt): Observable<PromptInfo | void>;

  deletePrompt(info: PromptInfo): Observable<void>;

  setPrompts(prompts: Prompt[]): Observable<PromptInfo>;

  move(data: MoveModel): Observable<MoveModel>;

  copyFiles(
    data: {
      files: DialCopiedItem[];
    },
    options?: { signal?: AbortSignal | null },
  ): Observable<FileOperationsResult<MoveModel>>;

  moveFiles(
    data: {
      files: DialCopiedItem[];
    },
    options?: { signal?: AbortSignal | null },
  ): Observable<FileOperationsResult<MoveModel>>;

  deleteFiles(data: {
    files: DialDeletedItem[];
  }): Observable<FileOperationsResult<string>>;

  uploadArchive(data: { file: File; destinationUrl: string }): Observable<void>;

  // Application methods
  createApplication(
    application: CustomApplicationModel,
    schema?: ApiDetailedApplicationTypeSchema,
  ): Observable<ApplicationInfo>;

  updateApplication(
    application: CustomApplicationModel,
    schema?: ApiDetailedApplicationTypeSchema,
  ): Observable<ApplicationInfo>;

  getApplication(
    applicationId: string,
  ): Observable<CustomApplicationModel | null>;

  getApplications(
    path?: string,
    recursive?: boolean,
  ): Observable<ApplicationInfo[]>;

  deleteApplication(applicationId: string): Observable<void>;

  deployApplication(applicationName: string): Observable<void>;

  redeployApplication(applicationName: string): Observable<void>;

  undeployApplication(applicationName: string): Observable<void>;

  getApplicationLogs(path: string): Observable<ApplicationLogsType>;

  getApplicationConfig(name: string): Observable<MessageFormSchema>;

  getAgentLimits(id: string): Observable<AgentUsageStats>;

  // Toolsets methods
  getToolsetById(id: string): Observable<ToolsetModel | null>;
  getToolsetsByPath(path: string): Observable<ToolsetInfo[]>;
  updateToolset(data: ToolsetModel): Observable<ToolsetInfo>;
  createToolset(data: ToolsetModel): Observable<ToolsetInfo>;
  deleteToolset(toolsetId: string): Observable<void>;
}
