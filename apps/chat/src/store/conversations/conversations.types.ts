import { PlotParams } from 'react-plotly.js';

import { ConversationInfo } from '@/src/types/chat';
import { UploadStatus } from '@/src/types/common';
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
  areSelectedConversationsLoaded: boolean;
  conversationsStatus: UploadStatus;
  foldersStatus: UploadStatus;
  loadingFolderIds: string[];
  isActiveNewConversationRequest: boolean;
  isMessageSending: boolean;
  loadedCharts: { url: string; data: PlotParams }[];
  chartLoading: boolean;
  compareLoading?: boolean;
}
