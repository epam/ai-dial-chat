import { cleanPrompt } from '@/src/utils/app/clean';
import { getPromptApiKey, parsePromptApiKey } from '@/src/utils/server/api';

import { ApiKeys, Entity } from '@/src/types/common';
import { Prompt, PromptInfo } from '@/src/types/prompt';

import { ApiEntityStorage } from './api-entity-storage';

export class PromptApiStorage extends ApiEntityStorage<PromptInfo, Prompt> {
  mergeGetResult(info: Entity, entity: Prompt): Prompt {
    return {
      ...entity,
      ...info,
    };
  }
  cleanUpEntity(prompt: Prompt): Prompt {
    return cleanPrompt(prompt);
  }
  getEntityKey(info: PromptInfo): string {
    return getPromptApiKey(info);
  }
  parseEntityKey(key: string): Omit<PromptInfo, 'folderId' | 'id'> {
    return parsePromptApiKey(key);
  }
  getStorageKey(): ApiKeys {
    return ApiKeys.Prompts;
  }
}
