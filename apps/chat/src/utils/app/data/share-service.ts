import { Observable, map } from 'rxjs';

import { BackendDataEntity } from '@/src/types/common';
import {
  ShareAcceptRequestModel,
  ShareByLinkResponseModel,
  ShareListingRequestModel,
  ShareRequestModel,
} from '@/src/types/share';

import { ApiUtils } from '../../server/api';

export class ShareService {
  public static share(
    shareData: ShareRequestModel,
  ): Observable<ShareByLinkResponseModel> {
    return ApiUtils.request(`api/share/create`, {
      method: 'POST',
      body: JSON.stringify(shareData),
    });
  }
  public static shareAccept(
    shareAcceptData: ShareAcceptRequestModel,
  ): Observable<void> {
    return ApiUtils.request(`api/share/accept`, {
      method: 'POST',
      body: JSON.stringify(shareAcceptData),
    });
  }
  public static getSharedListing(
    sharedListingData: ShareListingRequestModel,
  ): Observable<BackendDataEntity[]> {
    return ApiUtils.request(`api/share/listing`, {
      method: 'POST',
      body: JSON.stringify(sharedListingData),
    }).pipe(map((resp: { resources: BackendDataEntity[] }) => resp.resources));
  }
}
