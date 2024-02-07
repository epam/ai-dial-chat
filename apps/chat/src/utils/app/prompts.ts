import { Prompt } from '@/src/types/prompt';



import { getPromptApiKey } from '../server/api';
import { constructPath } from './file';

export const addGeneratedPromptId = (prompt: Omit<Prompt, 'id'>) => ({
  ...prompt,
  id: constructPath(prompt.folderId, getPromptApiKey(prompt)),
});
