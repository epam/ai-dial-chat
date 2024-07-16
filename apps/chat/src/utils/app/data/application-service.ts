import { Observable } from 'rxjs';
import { CreateApplicationModel, ApplicationListResponseModel, ApplicationDetailsResponse, ReadOnlyAppDetailsResponse, OpenAIApplicationListResponse } from '@/src/types/applications';
import { ApiUtils } from '../../server/api';
import { BucketService } from './bucket-service';
import { constructPath } from '../file';


export class ApplicationService {
  public static create(applicationName: string, applicationData: CreateApplicationModel): Observable<any> {
    const bucket = BucketService.getBucket();
    return ApiUtils.request(`api/application/create/${constructPath(bucket, ApiUtils.encodeApiUrl(applicationName))}`, {
      method: 'PUT',
      body: JSON.stringify(applicationData),
    });
}

  public static listing(): Observable<ApplicationListResponseModel[]> {
    const bucket = BucketService.getBucket();
    return ApiUtils.request(`api/application/listing/${bucket}`, {
      method: 'GET',
    });
  }
  
  public static fetchWriteOnlyAppDetails(appID: string): Observable<ApplicationDetailsResponse> {
    const bucket = BucketService.getBucket(); 
    return ApiUtils.request(`api/applications/${bucket}/${appID}`, {
      method: 'GET',
    });
  }

  public static fetchReadOnlyAppDetails(appID: string): Observable<ReadOnlyAppDetailsResponse> {
    const bucket = BucketService.getBucket();  
    return ApiUtils.request(`api/applications/${bucket}/${appID}`, {
      method: 'GET',
    });
  }

  public static fetchOpenAIApplications(): Observable<OpenAIApplicationListResponse> {
    return ApiUtils.request(`openai/applications`, {
      method: 'GET',
    });
  }
}