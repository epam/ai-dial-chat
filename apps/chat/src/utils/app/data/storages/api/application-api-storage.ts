import {
  getApplicationApiKey,
  parseApplicationApiKey,
} from '@/src/utils/server/api';

import {
  ApplicationInfo,
  CustomApplicationModel,
} from '@/src/types/applications';
import { ApiKeys } from '@/src/types/common';

import {
  ApiApplicationModel,
  ApplicationDetailsResponse,
  convertApplicationFromApi,
  convertApplicationToApi,
} from '../../../application';
import { ApiEntityStorage } from './api-entity-storage';

import { Entity } from '@epam/ai-dial-shared';

export class ApplicationApiStorage extends ApiEntityStorage<
  ApplicationInfo,
  CustomApplicationModel,
  ApplicationDetailsResponse,
  ApiApplicationModel
> {
  mergeGetResult(
    info: Entity,
    entity: ApplicationDetailsResponse,
  ): CustomApplicationModel {
    return {
      ...info,
      ...convertApplicationFromApi(entity),
    };
  }
  cleanUpEntity(application: CustomApplicationModel): ApiApplicationModel {
    return convertApplicationToApi(application);
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
