import { Observable } from 'rxjs';

import { Conversation } from '@/src/types/chat';

import { ApplicationInfo, CustomApplicationModel } from './applications';
import { MoveModel } from './common';
import { FolderInterface, FoldersAndEntities } from './folder';
import { Prompt, PromptInfo } from './prompt';

import { ConversationInfo, Entity } from '@epam/ai-dial-shared';

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
  RecentAddonsIds = 'recentAddonsIds',
  Settings = 'settings',
  ShowChatbar = 'showChatbar',
  ShowPromptbar = 'showPromptbar',
  ShowMarketplaceFilterbar = 'showMarketplaceFilterbar',
  ChatbarWidth = 'chatbarWidth',
  PromptbarWidth = 'promptbarWidth',
  IsChatFullWidth = 'isChatFullWidth',
  OpenedFoldersIds = 'openedFoldersIds',
  OpenedConversationFoldersIds = 'openedConversationFoldersIds',
  OpenedPromptFoldersIds = 'openedPromptFoldersIds',
  TextOfClosedAnnouncement = 'textOfClosedAnnouncement',
  CustomLogo = 'customLogo',
  ChatCollapsedSections = 'chatCollapsedSections',
  PromptCollapsedSections = 'promptCollapsedSections',
  FileCollapsedSections = 'fileCollapsedSections',
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
  TEntityInfo extends Entity,
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

  updateEntity(entity: TEntity): Observable<void>;

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

  createConversation(
    conversation: Conversation,
  ): Observable<ConversationInfo | null>;

  updateConversation(conversation: Conversation): Observable<void>;

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

  createPrompt(prompt: Prompt): Observable<PromptInfo | null>;

  updatePrompt(prompt: Prompt): Observable<void>;

  deletePrompt(info: PromptInfo): Observable<void>;

  setPrompts(prompts: Prompt[]): Observable<PromptInfo>;

  move(data: MoveModel): Observable<MoveModel>;

  createApplication(
    application: CustomApplicationModel,
  ): Observable<ApplicationInfo>;

  updateApplication(application: CustomApplicationModel): Observable<void>;

  getApplication(
    applicationId: string,
  ): Observable<CustomApplicationModel | null>;

  deleteApplication(applicationId: string): Observable<void>;

  startApplication(applicationName: string): Observable<void>;

  stopApplication(applicationName: string): Observable<void>;
}
