import { ConversationInfo } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { SearchFilters } from '@/src/types/search';

export interface ConversationsState {
  conversations: ConversationInfo[];
  selectedConversationsIds: string[];
  folders: FolderInterface[];
  temporaryFolders: FolderInterface[];
  searchTerm: string;
  searchFilters: SearchFilters;
  conversationSignal: AbortController;
  isReplayPaused: boolean;
  isPlaybackPaused: boolean;
  newAddedFolderId?: string;
  conversationsLoaded: boolean;
  isConversationLoading: boolean;
}
