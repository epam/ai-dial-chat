import { Observable, catchError, forkJoin, of } from 'rxjs';

import { cleanPrompt } from '@/src/utils/app/clean';
import { PromptService } from '@/src/utils/app/data/prompt-service';
import { constructPath } from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/folders';
import { regeneratePromptId } from '@/src/utils/app/prompts';
import { getPromptApiKey, parsePromptApiKey } from '@/src/utils/server/api';

import { ApiKeys } from '@/src/types/common';
import { Prompt, PromptInfo } from '@/src/types/prompt';

import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';

import { ApiEntityStorage } from './api-entity-storage';

import { RootState } from '@/src/store';
import { Entity, UploadStatus } from '@epam/ai-dial-shared';

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

export const getOrUploadPrompt = (
  payload: { id: string },
  state: RootState,
): Observable<{
  prompt: Prompt | null;
  payload: { id: string };
}> => {
  const prompt = PromptsSelectors.selectPrompt(state, payload.id);

  if (prompt?.status !== UploadStatus.LOADED) {
    const { apiKey, bucket, name, parentPath } = splitEntityId(payload.id);
    const prompt = regeneratePromptId({
      name,
      folderId: constructPath(apiKey, bucket, parentPath),
    });

    return forkJoin({
      prompt: PromptService.getPrompt(prompt).pipe(
        catchError((err) => {
          console.error('The prompt was not found:', err);
          return of(null);
        }),
      ),
      payload: of(payload),
    });
  } else {
    return forkJoin({
      prompt: of(prompt),
      payload: of(payload),
    });
  }
};
