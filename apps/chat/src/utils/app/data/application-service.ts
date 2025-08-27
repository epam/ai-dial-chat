import { Observable } from 'rxjs';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  ApplicationInfo,
  ApplicationLogsType,
  CustomApplicationModel,
} from '@/src/types/applications';

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
}
