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

export interface EntityStorage<
  EntityInfo extends { folderId?: string },
  Entity extends EntityInfo,
> {
  getEntities(path?: string): Observable<EntityInfo[]>; // listing with short information

  getEntity(info: EntityInfo): Observable<Entity>;

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

  setConversations(conversations: Conversation[]): Observable<void>;

  getPrompts(path?: string): Observable<PromptInfo[]>;

  getPrompt(info: PromptInfo): Observable<Prompt | null>;

  setPrompts(prompts: Prompt[]): Observable<void>;
}
