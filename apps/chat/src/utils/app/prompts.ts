import { splitEntityId } from '@/src/utils/app/shared-utils';
import { getPromptApiKey, parseEntityApiKey } from '@/src/utils/server/api';

import { PartialBy } from '@/src/types/common';
import { Prompt, PromptInfo, TemplateParameter } from '@/src/types/prompt';

import { DEFAULT_PROMPT_NAME } from '@/src/constants/default-ui-settings';
import { PROMPT_VARIABLE_REGEX_GLOBAL } from '@/src/constants/folders';

import {
  EntityStorageLimits,
  buildByteAwareFitBaseName,
  getAvailableEntityNameBytes,
  getResourceStorageLimits,
  getStorageSafeUniqueName,
  prepareEntityName,
  truncateToUtf8Bytes,
} from './common';
import { constructPath } from './file';

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

export const getAvailablePromptNameBytes = (
  prompt: PartialBy<PromptInfo, 'id'>,
  limits: EntityStorageLimits = getResourceStorageLimits(),
): number | undefined =>
  getAvailableEntityNameBytes(
    (name) => getGeneratedPromptId({ ...(prompt as Prompt), name }),
    (name) => getPromptApiKey({ ...prompt, name }),
    limits,
  );

export const getStorageSafeUniquePromptName = (params: {
  prompt: PartialBy<PromptInfo, 'id'>;
  desiredName?: string;
  defaultName?: string;
  existingNames: string[];
  limits?: EntityStorageLimits;
}): string => {
  const { prompt, desiredName, existingNames } = params;
  const limits = params.limits ?? getResourceStorageLimits();
  const defaultName = params.defaultName ?? DEFAULT_PROMPT_NAME;

  const availableNameBytes = getAvailablePromptNameBytes(prompt, limits);

  const uniqueName = getStorageSafeUniqueName({
    desiredName,
    defaultName,
    existingNames,
    fitBaseName: buildByteAwareFitBaseName(availableNameBytes),
  });

  if (uniqueName) {
    return uniqueName;
  }

  const baseName =
    prepareEntityName(desiredName ?? '') || prepareEntityName(defaultName);

  if (availableNameBytes === undefined) return baseName;
  return prepareEntityName(truncateToUtf8Bytes(baseName, availableNameBytes));
};

export const getPromptInfoFromId = (
  id: string,
  options?: Partial<{ parseVersion: boolean }>,
): PromptInfo => {
  const { apiKey, bucket, name, parentPath } = splitEntityId(id);

  const { name: parsedName, version } = parseEntityApiKey(name, {
    parseVersion: options?.parseVersion,
  });

  const regeneratePayload: Omit<PromptInfo, 'id'> = {
    name: parsedName,
    folderId: constructPath(apiKey, bucket, parentPath),
  };

  if (version) {
    regeneratePayload.publicationInfo = {
      version,
    };
  }

  return regeneratePromptId(regeneratePayload);
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

  while ((match = PROMPT_VARIABLE_REGEX_GLOBAL.exec(content)) !== null) {
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
    PROMPT_VARIABLE_REGEX_GLOBAL,
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
    PROMPT_VARIABLE_REGEX_GLOBAL,
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
    PROMPT_VARIABLE_REGEX_GLOBAL,
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

export const replaceTemplates = (
  templates: TemplateMapping[],
  text: string,
): string => {
  if (!templates.length) return text;
  const [[key, value], ...rest] = templates;
  return text
    .split(key.trim())
    .map((part) => replaceTemplates(rest, part))
    .join(value.trim());
};

export const generateSkillContent = (): string => {
  const slugName = 'skill-name';
  const desc = 'A description of what this skill does and when to use it.';
  return `---\nname: ${slugName}\ndescription: ${desc}\n---`;
};

export const areSomePromptsFieldsChanged = (
  firstPrompt: Pick<Prompt, 'name' | 'content' | 'description'>,
  secondPrompt: Pick<Prompt, 'name' | 'content' | 'description'>,
) => {
  return (
    firstPrompt.name !== secondPrompt.name ||
    firstPrompt.content !== secondPrompt.content ||
    firstPrompt.description !== secondPrompt.description
  );
};
