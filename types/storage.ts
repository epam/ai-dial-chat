import { Conversation } from './chat';
import { FolderInterface } from './folder';
import { Prompt } from './prompt';
import { Theme } from './settings';

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
