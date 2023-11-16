import { Observable } from 'rxjs';

import { Conversation } from './chat';
import { FolderInterface } from './folder';
import { Prompt } from './prompt';
import { Theme } from './settings';

export type StorageType = 'browserStorage' | 'api' | 'apiMock';

// keep track of local storage schema
export interface LocalStorage {
  conversationHistory: Conversation[];
  selectedConversationIds: string[];
  theme: Theme;
  // added folders (3/23/23)
  folders: FolderInterface[];
  // added prompts (3/26/23)
  prompts: Prompt[];
  // added showChatbar and showPromptbar (3/26/23)
  showChatbar: boolean;
  showPromptbar: boolean;
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
