import { Observable, catchError, forkJoin, of } from 'rxjs';

import { cleanPrompt } from '@/src/utils/app/clean';
import { PromptService } from '@/src/utils/app/data/prompt-service';
import { getPromptApiKey, parsePromptApiKey } from '@/src/utils/server/api';

import { ApiKeys } from '@/src/types/common';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { RootState } from '@/src/types/store';

import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';

import { ApiEntityStorage } from './api-entity-storage';

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

export const getOrUploadPrompt = <T extends { id: string }>(
  payload: T,
  state: RootState,
): Observable<{
  prompt: Prompt | null;
  payload: T;
  wasUploaded: boolean;
}> => {
  const prompt = PromptsSelectors.selectPrompt(state, payload.id);

  if (prompt && prompt?.status !== UploadStatus.LOADED) {
    return forkJoin({
      prompt: PromptService.getPrompt(prompt).pipe(
        catchError((err) => {
          console.error('The prompt was not found:', err);
          return of(null);
        }),
      ),
      payload: of(payload),
      wasUploaded: of(true),
    });
  } else {
    return of({
      prompt: prompt ?? null,
      payload: payload,
      wasUploaded: false,
    });
  }
};
