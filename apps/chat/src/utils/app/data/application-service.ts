import { Observable } from 'rxjs';

import {
  ApplicationDetailsResponse,
  ApplicationListResponseModel,
  CreateApplicationModel,
  OpenAIApplicationListResponse,
  ReadOnlyAppDetailsResponse,
} from '@/src/types/applications';

import { ApiUtils } from '../../server/api';
import { constructPath } from '../file';
import { BucketService } from './bucket-service';

export class ApplicationService {
  public static create(
    applicationName: string,
    applicationData: CreateApplicationModel,
  ): Observable<any> {
    const bucket = BucketService.getBucket();
    return ApiUtils.request(
      `api/applications/${constructPath(bucket, ApiUtils.encodeApiUrl(applicationName))}`,
      {
        method: 'POST',
        body: JSON.stringify(applicationData),
      },
    );
  }

  public static edit(
    applicationName: string,
    applicationData: CreateApplicationModel,
  ): Observable<any> {
    const bucket = BucketService.getBucket();
    return ApiUtils.request(
      `api/applications/${constructPath(bucket, ApiUtils.encodeApiUrl(applicationName))}`,
      {
        method: 'PUT',
        body: JSON.stringify(applicationData),
      },
    );
  }

  public static delete(applicationUrl: string): Observable<any> {
    const bucket = BucketService.getBucket();
    return ApiUtils.request(`api/applications/${constructPath(bucket, ApiUtils.encodeApiUrl(applicationUrl))}`, {
      method: 'DELETE',
    });
  }

  public static listing(): Observable<ApplicationListResponseModel[]> {
    const bucket = BucketService.getBucket();
    return ApiUtils.request(`api/application/listing/${bucket}`, {
      method: 'GET',
    });
  }

  public static getOne(appID: string): Observable<ApplicationDetailsResponse> {
    const oneData = ApiUtils.request(`api/${appID}`, {
      method: 'GET',
    });
    console.log(oneData, 'oneData');
    return oneData
  }
}
