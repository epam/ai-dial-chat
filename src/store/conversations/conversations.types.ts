import { Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { SearchFilters } from '@/src/types/search';

export interface ConversationsState {
  conversations: Conversation[];
  selectedConversationsIds: string[];
  folders: FolderInterface[];
  searchTerm: string;
  searchFilters: SearchFilters;
  conversationSignal: AbortController;
  isReplayPaused: boolean;
  isPlaybackPaused: boolean;
}
