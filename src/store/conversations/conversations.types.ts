import { Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';

export interface ConversationsState {
  conversations: Conversation[];
  selectedConversationsIds: string[];
  folders: FolderInterface[];
  searchTerm: string;
  conversationSignal: AbortController;
  isReplayPaused: boolean;
  isPlaybackPaused: boolean;
}
