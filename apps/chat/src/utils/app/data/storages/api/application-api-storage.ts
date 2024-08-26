import {
  getApplicationApiKey,
  parseApplicationApiKey,
} from '@/src/utils/server/api';

import {
  ApplicationInfo,
  CustomApplicationModel,
} from '@/src/types/applications';
import { ApiKeys, Entity } from '@/src/types/common';

import {
  ApplicationDetailsResponse,
  convertApplicationFromApi,
  convertApplicationToApi,
} from '../../../application';
import { ApiEntityStorage } from './api-entity-storage';

export class ApplicationApiStorage extends ApiEntityStorage<
  ApplicationInfo,
  CustomApplicationModel
> {
  mergeGetResult(
    info: Entity,
    entity: CustomApplicationModel,
  ): CustomApplicationModel {
    return {
      ...info,
      ...convertApplicationFromApi(
        entity as unknown as ApplicationDetailsResponse,
      ),
    };
  }
  cleanUpEntity(application: CustomApplicationModel): CustomApplicationModel {
    return convertApplicationToApi(
      application,
    ) as unknown as CustomApplicationModel;
  }
  getEntityKey(info: ApplicationInfo): string {
    return getApplicationApiKey(info);
  }
  parseEntityKey(key: string): Omit<ApplicationInfo, 'folderId' | 'id'> {
    return parseApplicationApiKey(key);
  }
  getStorageKey(): ApiKeys {
    return ApiKeys.Applications;
  }
}

// export const getOrUploadPrompt = (
//   payload: { id: string },
//   state: RootState,
// ): Observable<{
//   prompt: Prompt | null;
//   payload: { id: string };
// }> => {
//   const prompt = PromptsSelectors.selectPrompt(state, payload.id);

//   if (prompt?.status !== UploadStatus.LOADED) {
//     const { apiKey, bucket, name, parentPath } = splitEntityId(payload.id);
//     const prompt = regeneratePromptId({
//       name,
//       folderId: constructPath(apiKey, bucket, parentPath),
//     });

//     return forkJoin({
//       prompt: PromptService.getPrompt(prompt).pipe(
//         catchError((err) => {
//           console.error('The prompt was not found:', err);
//           return of(null);
//         }),
//       ),
//       payload: of(payload),
//     });
//   } else {
//     return forkJoin({
//       prompt: of(prompt),
//       payload: of(payload),
//     });
//   }
// };
