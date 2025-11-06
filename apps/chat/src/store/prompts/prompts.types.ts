import { FolderInterface } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { SearchFilters } from '@/src/types/search';

export interface PromptsState {
  initialized: boolean;
  prompts: PromptInfo[];
  folders: FolderInterface[];
  temporaryFolders: FolderInterface[];
  searchTerm: string;
  searchFilters: SearchFilters;
  selectedPromptId: string | undefined;
  isSelectedPromptApproveRequiredResource: boolean;
  isPromptModalOpen: boolean;
  isPromptModalInitModeEdit: boolean;
  newAddedFolderId?: string;
  promptsLoaded: boolean;
  isPromptLoading: boolean;
  loadingFolderIds: string[];
  isNewPromptCreating: boolean;
  chosenPromptIds: string[];
  chosenEmptyFoldersIds: string[];
  promptWithVariablesForApply?: Prompt;

  deletingPrompt: PromptInfo | undefined;
  moveToPrompt: PromptInfo | undefined;
}
