import { Observable, map } from 'rxjs';

import {
  ApplicationDetailsResponse,
  ApplicationInfo,
  ApplicationListItemModel,
  ApplicationListResponseModel,
  ApplicationMoveModel,
  CreateApplicationModel,
} from '@/src/types/applications';
import { ApiKeys, EntityType } from '@/src/types/common';
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
        ApiKeys.Applications,
        bucket,
        ApiUtils.encodeApiUrl(applicationName),
      ),
      {
        method: HTTPMethod.POST,
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
        ApiKeys.Applications,
        bucket,
        ApiUtils.encodeApiUrl(applicationData.display_name),
      ),
      {
        method: HTTPMethod.PUT,
        body: JSON.stringify(applicationData),
      },
    );
  }

  public static move(
    data: ApplicationMoveModel,
  ): Observable<ApplicationMoveModel> {
    const bucket = BucketService.getBucket();
    return ApiUtils.request('api/ops/resource/move', {
      method: HTTPMethod.POST,
      body: JSON.stringify({
        sourceUrl: constructPath(
          ApiKeys.Applications,
          bucket,
          ApiUtils.encodeApiUrl(data.sourceUrl),
        ),
        destinationUrl: constructPath(
          ApiKeys.Applications,
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
        ApiKeys.Applications,
        bucket,
        ApiUtils.encodeApiUrl(applicationUrl),
      ),
      {
        method: HTTPMethod.DELETE,
      },
    );
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

  public static get(appID: string): Observable<ApplicationInfo> {
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
