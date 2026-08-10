import { Observable, throwError } from 'rxjs';

import {
  convertApplicationFromApi,
  convertApplicationToApi,
} from '@/src/utils/app/application';
import { constructPath } from '@/src/utils/app/file';
import {
  ApiUtils,
  getMarketplaceEntityApiKey,
  getOpsApiUrl,
  parseEntityApiKey,
} from '@/src/utils/server/api';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  ApiApplicationModel,
  ApiApplicationResponse,
  ApplicationInfo,
  ApplicationLogsType,
  CustomApplicationModel,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { ApiKeys, CoreApiKeys } from '@/src/types/common';
import { HTTPMethod } from '@/src/types/http';
import { AgentUsageStats } from '@/src/types/models';
import { ServerSlugs } from '@/src/types/slugs-types';

import { DEFAULT_VERSION } from '@/src/constants/publication';

import { ApiEntityStorage } from './api-entity-storage';

import { MessageFormSchema } from '@epam/ai-dial-shared';

export class ApplicationApiStorage extends ApiEntityStorage<
  ApplicationInfo,
  CustomApplicationModel,
  ApiApplicationResponse,
  ApiApplicationModel
> {
  mergeGetResult(
    info: ApplicationInfo,
    entity: ApiApplicationResponse,
  ): CustomApplicationModel {
    return {
      ...info,
      ...convertApplicationFromApi(entity),
    };
  }
  cleanUpEntity(
    application: CustomApplicationModel,
    schema?: ApiDetailedApplicationTypeSchema,
  ): ApiApplicationModel {
    return convertApplicationToApi(application, schema);
  }
  getEntityKey(info: ApplicationInfo): string {
    return getMarketplaceEntityApiKey(info);
  }
  parseEntityKey(key: string): Omit<ApplicationInfo, 'folderId' | 'id'> {
    return parseEntityApiKey(key, {
      parseVersion: true,
      defaultVersion: DEFAULT_VERSION,
    });
  }
  getStorageKey(): ApiKeys {
    return ApiKeys.Applications;
  }

  toggleApplicationStatus(
    applicationId: string,
    status:
      | SimpleApplicationStatus.DEPLOY
      | SimpleApplicationStatus.UNDEPLOY
      | SimpleApplicationStatus.REDEPLOY,
  ): Observable<void> {
    try {
      return ApiUtils.request(getOpsApiUrl(ServerSlugs.APPLICATION, status), {
        method: HTTPMethod.POST,
        body: JSON.stringify({
          url: ApiUtils.encodeApiUrl(applicationId),
        }),
      });
    } catch (error) {
      return throwError(() => error);
    }
  }

  getLogs(path: string): Observable<ApplicationLogsType> {
    try {
      return ApiUtils.request(getOpsApiUrl(ServerSlugs.APPLICATION_LOGS), {
        method: HTTPMethod.POST,
        body: JSON.stringify({
          url: ApiUtils.encodeApiUrl(path),
        }),
      });
    } catch (error) {
      return throwError(() => error);
    }
  }

  getConfigurationSchema(applicationId: string): Observable<MessageFormSchema> {
    try {
      return ApiUtils.request(
        constructPath(
          '/api',
          CoreApiKeys.Deployments,
          ApiUtils.encodeApiUrl(applicationId),
          'configuration',
        ),
      );
    } catch (error) {
      return throwError(() => error);
    }
  }

  getAgentLimits(id: string): Observable<AgentUsageStats> {
    try {
      return ApiUtils.request(
        constructPath(
          '/api',
          CoreApiKeys.Deployments,
          ApiUtils.encodeApiUrl(id),
          'limits',
        ),
      );
    } catch (error) {
      return throwError(() => error);
    }
  }
}
