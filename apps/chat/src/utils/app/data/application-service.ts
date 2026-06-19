import { Observable, catchError, map, of } from 'rxjs';

import { ApiUtils } from '@/src/utils/server/api';
import { mapCoreEntityToDialModel } from '@/src/utils/server/map-core-entity';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  ApplicationInfo,
  ApplicationLogsType,
  CustomApplicationModel,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { HTTPMethod } from '@/src/types/http';
import {
  AgentUsageStats,
  CoreAIEntity,
  DialAIEntityModel,
} from '@/src/types/models';

import { DataService } from './data-service';

import { MessageFormSchema } from '@epam/ai-dial-shared';

export class ApplicationService {
  public static create(
    applicationData: CustomApplicationModel,
    schema?: ApiDetailedApplicationTypeSchema,
  ): Observable<ApplicationInfo> {
    return DataService.getDataStorage().createApplication(
      applicationData,
      schema,
    );
  }

  public static edit(
    applicationData: CustomApplicationModel,
    schema?: ApiDetailedApplicationTypeSchema,
  ): Observable<ApplicationInfo> {
    return DataService.getDataStorage().updateApplication(
      applicationData,
      schema,
    );
  }

  public static delete(applicationId: string): Observable<void> {
    return DataService.getDataStorage().deleteApplication(applicationId);
  }

  public static get(
    applicationId: string,
  ): Observable<CustomApplicationModel | null> {
    return DataService.getDataStorage().getApplication(applicationId);
  }

  public static getDialEntity(
    name: string,
  ): Observable<DialAIEntityModel | null> {
    return ApiUtils.request(`/api/models/applications/${name}`, {
      method: HTTPMethod.GET,
    }).pipe(
      map((entity) =>
        mapCoreEntityToDialModel(
          entity as CoreAIEntity<EntityType.Application>,
          false,
        ),
      ),
      catchError(() => of(null)),
    );
  }

  public static getAllByPath(
    path?: string,
    recursive?: boolean,
  ): Observable<ApplicationInfo[]> {
    return DataService.getDataStorage().getApplications(path, recursive);
  }

  public static deploy(applicationId: string): Observable<void> {
    return DataService.getDataStorage().deployApplication(applicationId);
  }

  public static redeploy(applicationId: string): Observable<void> {
    return DataService.getDataStorage().redeployApplication(applicationId);
  }

  public static undeploy(applicationId: string): Observable<void> {
    return DataService.getDataStorage().undeployApplication(applicationId);
  }

  public static getLogs(path: string): Observable<ApplicationLogsType> {
    return DataService.getDataStorage().getApplicationLogs(path);
  }

  public static getConfigurationSchema(
    applicationId: string,
  ): Observable<MessageFormSchema> {
    return DataService.getDataStorage().getApplicationConfig(applicationId);
  }

  public static getAgentLimits(id: string): Observable<AgentUsageStats> {
    return DataService.getDataStorage().getAgentLimits(id);
  }
}
