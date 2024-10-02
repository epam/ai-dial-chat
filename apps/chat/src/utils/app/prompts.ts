import { PartialBy } from '@/src/types/common';
import { Prompt, PromptInfo, TemplateParameter } from '@/src/types/prompt';

import { PROMPT_VARIABLE_REGEX } from '@/src/constants/folders';

import { getPromptApiKey, parsePromptApiKey } from '../server/api';
import { constructPath } from './file';
import { splitEntityId } from './folders';

import { TemplateMapping } from '@epam/ai-dial-shared';
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

export const getPromptInfoFromId = (id: string): PromptInfo => {
  const { apiKey, bucket, name, parentPath } = splitEntityId(id);
  return regeneratePromptId({
    ...parsePromptApiKey(name),
    folderId: constructPath(apiKey, bucket, parentPath),
  });
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
      defaultValue: match[2]?.slice(1).trim() ?? '',
    });
  }

  return foundVariables;
};

const combinationWithoutSpecialRegexSymbols = '<<<>>>';

export const templateMatchContent = (
  content: string,
  template: string,
): boolean => {
  let regexpString = template.replaceAll(
    // replace all variable values by special combination
    PROMPT_VARIABLE_REGEX,
    combinationWithoutSpecialRegexSymbols,
  );
  regexpString = escapeRegExp(regexpString); // encode all specilal symbols
  regexpString = regexpString.replaceAll(
    combinationWithoutSpecialRegexSymbols,
    '(.*)',
  ); // replace special combination by regex group
  const regexp = new RegExp(`^${regexpString}$`);
  return regexp.test(content);
};

export const replaceDefaultValuesFromContent = (
  content: string,
  template: string,
) => {
  let regexpString = template.replaceAll(
    // replace all variable values by special combination
    PROMPT_VARIABLE_REGEX,
    combinationWithoutSpecialRegexSymbols,
  );
  regexpString = escapeRegExp(regexpString); // encode all specilal symbols
  regexpString = regexpString.replaceAll(
    combinationWithoutSpecialRegexSymbols,
    '(.*)',
  ); // replace special combination by regex group
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

export const getEntitiesFromTemplateMapping = (
  templateMapping: Record<string, string> | TemplateMapping[] | undefined,
): TemplateMapping[] => {
  if (!templateMapping) {
    return [];
  }
  return Array.isArray(templateMapping)
    ? templateMapping
    : Object.entries(templateMapping);
};
