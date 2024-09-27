import { PlotParams } from 'react-plotly.js';

import { FolderInterface } from '@/src/types/folder';
import { SearchFilters } from '@/src/types/search';

import {
  ConversationInfo,
  CustomVisualizerData,
  UploadStatus,
} from '@epam/ai-dial-shared';

export interface ConversationsState {
  conversations: ConversationInfo[];
  selectedConversationsIds: string[];
  folders: FolderInterface[];
  temporaryFolders: FolderInterface[];
  searchTerm: string;
  searchFilters: SearchFilters;
  conversationSignal: AbortController;
  isReplayPaused: boolean;
  isReplayRequiresVariables?: boolean;
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
  loadedCustomAttachmentsData: { url: string; data: CustomVisualizerData }[];
  customAttachmentDataLoading: boolean;
  chosenConversationIds: string[];
  chosenEmptyFoldersIds: string[];
}
