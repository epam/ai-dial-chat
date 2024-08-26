import { Observable } from 'rxjs';

import {
  ApplicationInfo,
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

  public static delete(applicationInfo: ApplicationInfo): Observable<void> {
    return DataService.getDataStorage().deleteApplication(applicationInfo);
  }

  public static get(
    applicationInfo: ApplicationInfo,
  ): Observable<CustomApplicationModel | null> {
    return DataService.getDataStorage().getApplication(applicationInfo);
  }
}
