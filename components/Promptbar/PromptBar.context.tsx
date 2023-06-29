import { Dispatch, createContext } from 'react';

import { ActionType } from '@/hooks/useCreateReducer';

import { PromptsHistory } from '@/types/export';
import { Prompt } from '@/types/prompt';

import { PromptbarInitialState } from './Promptbar.state';

export type ImportPromptsHandler = (promptsHistory: PromptsHistory) => void;
export interface PromptbarContextProps {
  state: PromptbarInitialState;
  dispatch: Dispatch<ActionType<PromptbarInitialState>>;
  handleCreatePrompt: () => void;
  handleDeletePrompt: (prompt: Prompt) => void;
  handleUpdatePrompt: (prompt: Prompt) => void;
  handleExportPrompts: () => void;
  handleImportPrompts: ImportPromptsHandler;
  handleClearAllPrompts: () => void;
}

const PromptbarContext = createContext<PromptbarContextProps>(undefined!);

export default PromptbarContext;
