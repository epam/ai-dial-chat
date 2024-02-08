import {
  ApiKeys,
  getPromptApiKey,
  parsePromptApiKey,
} from '@/src/utils/server/api';

import { Entity } from '@/src/types/common';
import { Prompt, PromptInfo } from '@/src/types/prompt';

import { ApiEntityStorage } from './api-entity-storage';

export class PromptApiStorage extends ApiEntityStorage<PromptInfo, Prompt> {
  mergeGetResult(info: Entity, entity: Prompt): Prompt {
    return {
      ...entity,
      ...info,
    };
  }
  cleanUpEntity(entity: Prompt): Prompt {
    return {
      ...entity,
      status: undefined,
    };
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
