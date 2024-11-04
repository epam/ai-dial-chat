import { Observable } from 'rxjs';

import {
  ApplicationInfo,
  ApplicationLogsType,
  CustomApplicationModel,
} from '@/src/types/applications';

import { DataService } from './data-service';

export class ApplicationService {
  public static create(
    applicationData: CustomApplicationModel,
  ): Observable<ApplicationInfo> {
    return DataService.getDataStorage().createApplication(applicationData);
  }

  public static edit(
    applicationData: CustomApplicationModel,
  ): Observable<void> {
    return DataService.getDataStorage().updateApplication(applicationData);
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

  public static undeploy(applicationId: string): Observable<void> {
    return DataService.getDataStorage().undeployApplication(applicationId);
  }

  public static getLogs(path: string): Observable<ApplicationLogsType> {
    return DataService.getDataStorage().getApplicationLogs(path);
  }
}
