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
  isQuickAppEditPrompt: boolean;
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

  deletingPromptId: string | undefined;
  moveToPromptId: string | undefined;
  quickAppUpdatedPrompt: { oldId: string; newId: string } | null;
  skillValidationByPromptId: Record<string, SkillValidationState>;
}

export enum SkillValidationStatus {
  Unknown = 'unknown',
  Validating = 'validating',
  Valid = 'valid',
  Invalid = 'invalid',
}

export interface SkillValidationState {
  status: SkillValidationStatus;
  validatedContent?: string;
  deploymentId?: string;
  message?: string;
}
