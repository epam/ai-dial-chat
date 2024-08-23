import { Observable, map } from 'rxjs';

import { CustomApplicationModel } from '@/src/types/applications';
import { BackendDataEntity } from '@/src/types/common';
import { HTTPMethod } from '@/src/types/http';

import { ApiUtils } from '../../server/api';
import {
  convertApplicationFromApi,
  convertApplicationToApi,
  getGeneratedApplicationId,
} from '../application';
import { constructPath } from '../file';

const getEntityUrl = (id: string): string => constructPath('api', id);

const getEncodedEntityUrl = (id: string): string =>
  ApiUtils.encodeApiUrl(getEntityUrl(id));

export class ApplicationService {
  public static create(
    applicationData: Omit<CustomApplicationModel, 'id' | 'reference'>,
  ): Observable<BackendDataEntity> {
    return ApiUtils.request(
      getEncodedEntityUrl(getGeneratedApplicationId(applicationData)),
      {
        method: HTTPMethod.POST,
        body: JSON.stringify(convertApplicationToApi(applicationData)),
      },
    );
  }

  public static edit(
    applicationData: CustomApplicationModel,
  ): Observable<BackendDataEntity> {
    return ApiUtils.request(
      getEncodedEntityUrl(getGeneratedApplicationId(applicationData)),
      {
        method: HTTPMethod.PUT,
        body: JSON.stringify({
          ...convertApplicationToApi(applicationData),
          reference: applicationData.reference,
        }),
      },
    );
  }

  public static delete(applicationId: string): Observable<string> {
    return ApiUtils.request(getEntityUrl(applicationId), {
      method: HTTPMethod.DELETE,
    });
  }

  public static get(applicationId: string): Observable<CustomApplicationModel> {
    return ApiUtils.request(getEntityUrl(applicationId), {
      method: HTTPMethod.GET,
    }).pipe(map((application) => convertApplicationFromApi(application)));
  }
}
