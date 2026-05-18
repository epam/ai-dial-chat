import { Injectable } from '@nestjs/common';
import { AppService } from '../../app/app.service';
import { handleDialError } from '../../common/utils/dial-error';

@Injectable()
export class BucketService extends AppService {
  async getUserBucket(
    token: string,
  ): Promise<{ bucket: string; appdata?: string }> {
    try {
      const result = (await this.client.getUserBucket({
        headers: { Authorization: `Bearer ${token}` },
      })) as { data: { bucket: string; appdata?: string } };
      return result.data;
    } catch (error) {
      return handleDialError(error);
    }
  }
}
