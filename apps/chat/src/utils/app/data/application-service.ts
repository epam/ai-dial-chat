import { Observable, map } from 'rxjs';

import {
  ApplicationDetailsResponse,
  ApplicationListItemModel,
  ApplicationListResponseModel,
  ApplicationMoveModel,
  CustomApplicationModel,
} from '@/src/types/applications';
import { HTTPMethod } from '@/src/types/http';

import { ApiUtils } from '../../server/api';
import {
  convertApplicationFromApi,
  convertApplicationToApi,
  getGeneratedApplicationId,
} from '../application';
import { constructPath } from '../file';
import { BucketService } from './bucket-service';

const getEntityUrl = (id: string): string => constructPath('api', id);

const getEncodedEntityUrl = (id: string): string =>
  ApiUtils.encodeApiUrl(getEntityUrl(id));

export class ApplicationService {
  public static create(
    applicationData: Omit<CustomApplicationModel, 'id' | 'reference'>,
  ): Observable<ApplicationListItemModel> {
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
  ): Observable<ApplicationListItemModel> {
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

  public static move(
    data: ApplicationMoveModel,
  ): Observable<ApplicationMoveModel> {
    return ApiUtils.request('api/ops/resource/move', {
      method: HTTPMethod.POST,
      body: JSON.stringify({
        sourceUrl: data.sourceUrl,
        destinationUrl: data.destinationUrl,
        overwrite: data.overwrite,
      }),
    });
  }

  public static delete(applicationId: string): Observable<string> {
    return ApiUtils.request(getEntityUrl(applicationId), {
      method: HTTPMethod.DELETE,
    });
  }

  public static listing(): Observable<ApplicationListResponseModel[]> {
    const bucket = BucketService.getBucket();
    return ApiUtils.request(
      constructPath('api', 'application', 'listing', bucket),
      {
        method: HTTPMethod.GET,
      },
    );
  }

  public static get(applicationId: string): Observable<CustomApplicationModel> {
    return ApiUtils.request(getEntityUrl(applicationId), {
      method: HTTPMethod.GET,
    }).pipe(
      map((application: ApplicationDetailsResponse) =>
        convertApplicationFromApi(application),
      ),
    );
  }
}
