import { PartialBy } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';

import { getPromptApiKey } from '../server/api';
import { constructPath } from './file';

const getGeneratedPromptId = (prompt: PartialBy<Prompt, 'id'>) =>
  constructPath(prompt.folderId, getPromptApiKey(prompt));

export const addGeneratedPromptId = (
  prompt: PartialBy<Prompt, 'id'>,
): Prompt => {
  const newId = getGeneratedPromptId(prompt);
  if (!prompt.id || newId !== prompt.id) {
    return {
      ...prompt,
      id: newId,
    };
  }
  return prompt as Prompt;
};
