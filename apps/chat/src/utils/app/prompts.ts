import { PartialBy } from '@/src/types/common';
import { Prompt, PromptInfo, TemplateParameter } from '@/src/types/prompt';

import { PROMPT_VARIABLE_REGEX } from '@/src/constants/folders';

import { getPromptApiKey, parsePromptApiKey } from '../server/api';
import { constructPath } from './file';
import { splitEntityId } from './folders';

import escapeRegExp from 'lodash-es/escapeRegExp';

const getGeneratedPromptId = (prompt: PartialBy<Prompt, 'id'>) =>
  constructPath(prompt.folderId, getPromptApiKey(prompt));

export const regeneratePromptId = (prompt: PartialBy<Prompt, 'id'>): Prompt => {
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
export const parseVariablesFromContent = (
  content?: string,
): TemplateParameter[] => {
  const foundVariables = [];
  let match;

  if (!content) return [];

  while ((match = PROMPT_VARIABLE_REGEX.exec(content)) !== null) {
    foundVariables.push({
      name: match[1],
      defaultValue: match[2]?.slice(1) ?? '',
    });
  }

  return foundVariables;
};

export const getPromptInfoFromId = (id: string): PromptInfo => {
  const { apiKey, bucket, name, parentPath } = splitEntityId(id);
  return regeneratePromptId({
    ...parsePromptApiKey(name),
    folderId: constructPath(apiKey, bucket, parentPath),
  });
};

export const replaceDefaultValuesFromContent = (
  content: string,
  template: string,
) => {
  let regexpString = template.replaceAll(PROMPT_VARIABLE_REGEX, '<<<>>>'); // replace all variable values by special combination without special regex symbols
  regexpString = escapeRegExp(regexpString); // encode all specilal symbols
  regexpString = regexpString.replaceAll('<<<>>>', '(.*)'); // replace special combination by regex group
  const regexp = new RegExp(`^${regexpString}$`);
  const match = regexp.exec(content); // find all variable values
  let ind = 1;
  const newTemplate = template.replace(
    PROMPT_VARIABLE_REGEX,
    function (_, variableName) {
      return `{{${variableName}|${match?.[ind++]}}}`; // replace each variable by variable with default value from content
    },
  );
  return newTemplate;
};
