import { FolderInterface } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { SearchFilters } from '@/src/types/search';

export interface PromptsState {
  migratedPromptsCount: number;
  promptsToMigrateCount: number;
  failedMigratedPrompts: Prompt[];
  prompts: PromptInfo[];
  folders: FolderInterface[];
  temporaryFolders: FolderInterface[];
  searchTerm: string;
  searchFilters: SearchFilters;
  selectedPromptId: string | undefined;
  isEditModalOpen: boolean;
  newAddedFolderId?: string;
  promptsLoaded: boolean;
  isPromptLoading: boolean;
  loadingFolderIds: string[];
  isActiveNewPromptRequest: boolean;
}
