import { Observable, map } from 'rxjs';

import {
  ApplicationDetailsResponse,
  ApplicationListItemModel,
  ApplicationListResponseModel,
  ApplicationMoveModel,
  CreateApplicationModel,
  CustomApplicationModel,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { HTTPMethod } from '@/src/types/http';

import { ApiUtils } from '../../server/api';
import { constructPath } from '../file';
import { BucketService } from './bucket-service';

export class ApplicationService {
  public static create(
    applicationName: string,
    applicationData: CreateApplicationModel,
  ): Observable<ApplicationListItemModel> {
    const bucket = BucketService.getBucket();
    return ApiUtils.request(
      constructPath(
        'api',
        'applications',
        bucket,
        ApiUtils.encodeApiUrl(applicationName),
      ),
      {
        method: 'POST',
        body: JSON.stringify(applicationData),
      },
    );
  }

  public static edit(
    applicationData: CreateApplicationModel,
  ): Observable<ApplicationListItemModel> {
    const bucket = BucketService.getBucket();
    return ApiUtils.request(
      constructPath(
        'api',
        'applications',
        bucket,
        ApiUtils.encodeApiUrl(applicationData.display_name),
      ),
      {
        method: 'PUT',
        body: JSON.stringify(applicationData),
      },
    );
  }

  public static move(
    data: ApplicationMoveModel,
  ): Observable<ApplicationMoveModel> {
    const bucket = BucketService.getBucket();
    return ApiUtils.request('api/ops/resource/move', {
      method: 'POST',
      body: JSON.stringify({
        sourceUrl: constructPath(
          'applications',
          bucket,
          ApiUtils.encodeApiUrl(data.sourceUrl),
        ),
        destinationUrl: constructPath(
          'applications',
          bucket,
          ApiUtils.encodeApiUrl(data.destinationUrl),
        ),
        overwrite: data.overwrite,
      }),
    });
  }

  public static delete(applicationUrl: string): Observable<string> {
    const bucket = BucketService.getBucket();
    return ApiUtils.request(
      constructPath(
        'api',
        'applications',
        bucket,
        ApiUtils.encodeApiUrl(applicationUrl),
      ),
      {
        method: 'DELETE',
      },
    );
  }

  public static listing(): Observable<ApplicationListResponseModel[]> {
    const bucket = BucketService.getBucket();
    return ApiUtils.request(
      constructPath('api', 'application', 'listing', bucket),
      {
        method: 'GET',
      },
    );
  }

  public static get(appID: string): Observable<CustomApplicationModel> {
    return ApiUtils.request(constructPath('api', appID), {
      method: HTTPMethod.GET,
    }).pipe(
      map((application: ApplicationDetailsResponse) => ({
        ...application,
        isDefault: false,
        type: EntityType.Application,
        id: application.name,
        inputAttachmentTypes: application.input_attachment_types,
        iconUrl: application.icon_url,
        maxInputAttachments: application.max_input_attachments,
        version: application.display_version,
        name: application.display_name,
        completionUrl: application.endpoint,
      })),
    );
  }
}
