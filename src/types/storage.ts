import { Observable } from 'rxjs';

import { Conversation } from '@/src/types/chat';

import { ConversationInfo } from './chat';
import { FolderInterface } from './folder';
import { Prompt, PromptInfo } from './prompt';

export enum StorageType {
  BrowserStorage = 'browserStorage',
  API = 'api',
}

export enum UIStorageKeys {
  Prompts = 'prompts',
  ConversationHistory = 'conversationHistory',
  Folders = 'folders',
  SelectedConversationIds = 'selectedConversationIds',
  RecentModelsIds = 'recentModelsIds',
  RecentAddonsIds = 'recentAddonsIds',
  Settings = 'settings',
  ShowChatbar = 'showChatbar',
  ShowPromptbar = 'showPromptbar',
  ChatbarWidth = 'chatbarWidth',
  PromptbarWidth = 'promptbarWidth',
  IsChatFullWidth = 'isChatFullWidth',
  OpenedFoldersIds = 'openedFoldersIds',
  TextOfClosedAnnouncement = 'textOfClosedAnnouncement',
}

export enum MigrationStorageKeys {
  MigratedConversationIds = 'migratedConversationIds',
  MigratedPromptIds = 'migratedPromptIds',
  IsConversationsMigrated = 'isConversationsMigrated',
  IsPromptsMigrated = 'isPromptsMigrated',
}

export interface EntityStorage<
  EntityInfo extends { folderId?: string },
  Entity extends EntityInfo,
> {
  getFolders(path?: string): Observable<FolderInterface[]>; // listing with short information

  getEntities(path?: string): Observable<EntityInfo[]>; // listing with short information

  getEntity(info: EntityInfo): Observable<Entity | null>;

  createEntity(entity: Entity): Observable<void>;

  updateEntity(entity: Entity): Observable<void>;

  deleteEntity(info: EntityInfo): Observable<void>;

  getEntityKey(info: EntityInfo): string;

  parseEntityKey(key: string): EntityInfo;

  getStorageKey(): string; // e.g. ApiKeys or `conversationHistory`/`prompts` in case of localStorage
}

export interface DialStorage {
  getConversationsFolders(): Observable<FolderInterface[]>;

  setConversationsFolders(folders: FolderInterface[]): Observable<void>;

  getPromptsFolders(): Observable<FolderInterface[]>;

  setPromptsFolders(folders: FolderInterface[]): Observable<void>;

  getConversations(path?: string): Observable<ConversationInfo[]>;

  getConversation(info: ConversationInfo): Observable<Conversation | null>;

  createConversation(conversation: Conversation): Observable<void>;

  updateConversation(conversation: Conversation): Observable<void>;

  deleteConversation(info: ConversationInfo): Observable<void>;

  setConversations(conversations: Conversation[]): Observable<void>;

  getPrompts(path?: string): Observable<PromptInfo[]>;

  getPrompt(info: PromptInfo): Observable<Prompt | null>;

  createPrompt(prompt: Prompt): Observable<void>;

  updatePrompt(prompt: Prompt): Observable<void>;

  deletePrompt(info: PromptInfo): Observable<void>;

  setPrompts(prompts: Prompt[]): Observable<void>;
}
