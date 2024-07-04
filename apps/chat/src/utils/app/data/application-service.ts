import { Observable } from 'rxjs';
import { CreateApplicationModel, ApplicationListResponseModel } from '@/src/types/applications';
import { ApiUtils } from '../../server/api';
import { BucketService } from './bucket-service';
import { constructPath } from '../file';

export class ApplicationService {
  public static create(applicationData: CreateApplicationModel): Observable<any> {
    const bucket = BucketService.getBucket();
    
    return ApiUtils.request(`api/application/create/${constructPath(bucket,'my-app')}`, {
      method: 'PUT',
      body: JSON.stringify(applicationData),
    });
  }

  public static fetchApplicationsList(): Observable<ApplicationListResponseModel> {
    return ApiUtils.request('api/application/listing', {
      method: 'GET',
    });
  }
  
}