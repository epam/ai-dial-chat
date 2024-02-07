import {
  ApiKeys,
  getPromptApiKey,
  parsePromptApiKey,
} from '@/src/utils/server/api';

import { Prompt, PromptInfo } from '@/src/types/prompt';

import { ApiEntityStorage } from './api-entity-storage';

export class PromptApiStorage extends ApiEntityStorage<PromptInfo, Prompt> {
  cleanUpEntity(entity: Prompt): Prompt {
    return entity;
  }
  getEntityKey(info: PromptInfo): string {
    return getPromptApiKey(info);
  }
  parseEntityKey(key: string): PromptInfo {
    return parsePromptApiKey(key);
  }
  getStorageKey(): ApiKeys {
    return ApiKeys.Prompts;
  }
}
