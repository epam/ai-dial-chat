import { Observable } from 'rxjs';

import { Conversation } from './chat';
import { FolderInterface } from './folder';
import { Prompt } from './prompt';

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
export interface DialStorage {
  setBucket(bucket: string): void;

  getConversationsFolders(): Observable<FolderInterface[]>;
  setConversationsFolders(folders: FolderInterface[]): Observable<void>;
  getPromptsFolders(): Observable<FolderInterface[]>;
  setPromptsFolders(folders: FolderInterface[]): Observable<void>;

  getConversations(): Observable<Conversation[]>;
  setConversations(conversations: Conversation[]): Observable<void>;
  getPrompts(): Observable<Prompt[]>;
  setPrompts(prompts: Prompt[]): Observable<void>;
}
