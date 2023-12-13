import { Observable } from 'rxjs';

import { Conversation } from './chat';
import { FolderInterface } from './folder';
import { Prompt } from './prompt';

export type StorageType = 'browserStorage' | 'api' | 'apiMock';

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
  OpenedFoldersIds = 'openedFoldersIds',
  TextOfClosedAnnouncement = 'textOfClosedAnnouncement',
}
export interface DialStorage {
  getConversationsFolders(): Observable<FolderInterface[]>;
  setConversationsFolders(folders: FolderInterface[]): Observable<void>;
  getPromptsFolders(): Observable<FolderInterface[]>;
  setPromptsFolders(folders: FolderInterface[]): Observable<void>;

  getConversations(): Observable<Conversation[]>;
  setConversations(conversations: Conversation[]): Observable<void>;
  getPrompts(): Observable<Prompt[]>;
  setPrompts(prompts: Prompt[]): Observable<void>;
}
