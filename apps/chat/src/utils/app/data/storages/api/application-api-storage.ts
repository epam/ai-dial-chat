import { Observable, throwError } from 'rxjs';

import { constructPath } from '@/src/utils/app/file';
import {
  ApiUtils,
  getApplicationApiKey,
  parseApplicationApiKey,
} from '@/src/utils/server/api';

import {
  ApiApplicationModel,
  ApplicationInfo,
  CustomApplicationModel,
} from '@/src/types/applications';
import { ApiKeys } from '@/src/types/common';
import { HTTPMethod } from '@/src/types/http';

import {
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

  toggleApplicationStatus(
    applicationId: string,
    status: 'start' | 'stop',
  ): Observable<void> {
    try {
      return ApiUtils.request(constructPath('api/ops/application', status), {
        method: HTTPMethod.POST,
        body: JSON.stringify({
          url: ApiUtils.encodeApiUrl(applicationId),
        }),
      });
    } catch (error) {
      return throwError(() => error);
    }
  }
}
