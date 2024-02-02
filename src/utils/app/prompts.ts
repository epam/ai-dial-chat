import { Prompt } from '@/src/types/prompt';

import { getParentPath, getPromptApiKey } from '../server/api';
import { constructPath } from './file';

export const addGeneratedPromptId = (prompt: Omit<Prompt, 'id'>) => ({
  ...prompt,
  id: constructPath(getParentPath(prompt.folderId), getPromptApiKey(prompt)),
});
