import { Injectable } from '@nestjs/common';
import { AppService } from '../../app/app.service';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { handleDialError } from '../../common/utils/dial-error';

@Injectable()
export class BucketService extends AppService {
  async getUserBucket(
    token: string,
  ): Promise<{ bucket: string; appdata?: string }> {
    try {
      return (await this.client.getUserBucket({
        headers: getBearerAuthHeaders(token),
      })) as {
        bucket: string;
        appdata?: string;
      };
    } catch (error) {
      return handleDialError(error);
    }
  }
}
