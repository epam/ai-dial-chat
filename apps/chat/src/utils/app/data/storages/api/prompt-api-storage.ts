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
    return {
      id: prompt.id,
      name: prompt.name,
      folderId: prompt.folderId,
      description: prompt.description,
      content: prompt.content ?? '', // will be required soon in https://github.com/epam/ai-dial-chat/issues/78
    };
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
