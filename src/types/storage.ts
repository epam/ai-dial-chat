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

export interface EntityStorage<EntityInfo, Entity> {
  getEntities(path: string): Observable<EntityInfo[]>;

  getEntity(info: EntityInfo): Observable<Entity>;

  createEntity(info: EntityInfo): Observable<void>;

  updateEntity(info: EntityInfo): Observable<void>;

  deleteEntity(info: EntityInfo): Observable<void>;

  getKey(info: EntityInfo): string;

  parseKey(key: string): EntityInfo;
}

export interface DialStorage {
  getConversationsFolders(): Observable<FolderInterface[]>;

  setConversationsFolders(folders: FolderInterface[]): Observable<void>;

  getPromptsFolders(): Observable<FolderInterface[]>;

  setPromptsFolders(folders: FolderInterface[]): Observable<void>;

  getConversations(path?: string): Observable<ConversationInfo[]>;

  getConversation(
    info: ConversationInfo,
    path?: string,
  ): Observable<Conversation>;

  setConversations(conversations: Conversation[]): Observable<void>;

  getPrompts(path?: string): Observable<PromptInfo[]>;

  getPrompt(info: PromptInfo, path?: string): Observable<Prompt>;

  setPrompts(prompts: Prompt[]): Observable<void>;
}
