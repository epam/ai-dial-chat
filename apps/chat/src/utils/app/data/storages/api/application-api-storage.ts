import { Observable, throwError } from 'rxjs';

import { BucketService } from '@/src/utils/app/data/bucket-service';
import { constructPath } from '@/src/utils/app/file';
import {
  ApiUtils,
  getApplicationApiKey,
  parseApplicationApiKey,
} from '@/src/utils/server/api';

import {
  ApplicationInfo,
  ApplicationStatus,
  CustomApplicationModel,
} from '@/src/types/applications';
import { ApiKeys } from '@/src/types/common';
import { HTTPMethod } from '@/src/types/http';

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

  toggleApplicationStatus(
    name: string,
    status: ApplicationStatus,
  ): Observable<void> {
    const endpoint = status === ApplicationStatus.STARTED ? 'start' : 'stop';
    try {
      return ApiUtils.request(constructPath(this.getStorageKey(), endpoint), {
        method: HTTPMethod.POST,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: ApiUtils.encodeApiUrl(
            constructPath('applications', BucketService.getBucket(), name),
          ),
        }),
      });
    } catch (error) {
      return throwError(() => error);
    }
  }
}
