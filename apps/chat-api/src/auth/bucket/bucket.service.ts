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
      const { data, error } = (await this.client.getUserBucket({
       headers: getBearerAuthHeaders(token),
      })) as {
        data?: { bucket: string; appdata?: string };
        error?: unknown;
      };
      if (error !== undefined || !data) {
        return handleDialError(error);
      }
      return data;
    } catch (error) {
      return handleDialError(error);
    }
  }
}
