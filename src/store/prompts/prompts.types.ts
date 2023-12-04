import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';

export interface PromptsState {
  prompts: Prompt[];
  folders: FolderInterface[];
  searchTerm: string;
  selectedPromptId: string | undefined;
  isEditModalOpen: boolean;
}
