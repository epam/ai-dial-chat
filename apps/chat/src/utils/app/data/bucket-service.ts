import { Observable } from 'rxjs';

import { ApiUtils } from '../../server/api';

export class BucketService {
  private static bucket: string;
  public static requestBucket(): Observable<{ bucket: string }> {
    return ApiUtils.request('api/bucket', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  public static getBucket(): string {
    return this.bucket;
  }

  public static setBucket(bucket: string): void {
    this.bucket = bucket;
  }
}
