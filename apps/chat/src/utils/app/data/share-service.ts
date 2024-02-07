import { Observable } from 'rxjs';

import {
  ShareAcceptRequestModel,
  ShareByLinkResponseModel,
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
}
