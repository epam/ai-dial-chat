import { FolderInterface } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { SearchFilters } from '@/src/types/search';

export interface PromptsState {
  migratedPromptsCount: number;
  promptsToMigrateCount: number;
  isPromptsBackedUp: boolean;
  failedMigratedPrompts: Prompt[];
  prompts: PromptInfo[];
  folders: FolderInterface[];
  temporaryFolders: FolderInterface[];
  searchTerm: string;
  searchFilters: SearchFilters;
  selectedPromptId: string | undefined;
  isEditModalOpen: boolean;
  isModalPreviewMode: boolean;
  newAddedFolderId?: string;
  promptsLoaded: boolean;
  isPromptLoading: boolean;
  loadingFolderIds: string[];
  isNewPromptCreating: boolean;
  isPromptContentCopying: boolean;
}
