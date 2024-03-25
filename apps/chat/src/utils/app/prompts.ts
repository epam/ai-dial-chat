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

/**
 * Parses a string for variables in the {{variable}} format and extracts them.
 * @param content The string to be parsed.
 * @returns An array of found variables.
 */
export const parseVariablesFromContent = (content?: string) => {
  const regex = /{{(.*?)}}/g;
  const foundVariables = [];
  let match;

  if (!content) return [];

  while ((match = regex.exec(content)) !== null) {
    foundVariables.push(match[1]);
  }

  return foundVariables;
};
