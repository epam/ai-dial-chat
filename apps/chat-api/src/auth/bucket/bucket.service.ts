import { Injectable } from '@nestjs/common';
import { AppService } from '../../app/app.service';
import { handleDialError } from '../../common/utils/dial-error';
import { createSDK } from '@epam/ai-dial-typescript-sdk';

@Injectable()
export class BucketService extends AppService {
  async getUserBucket(token: string): Promise<{ bucket: string; appdata?: string }> {
    try {
      return (await this.client.getUserBucket(    { headers: { Authorization: `Bearer ${token}` } })) as {
        bucket: string;
        appdata?: string;
      };
    } catch (error) {
      return handleDialError(error);
    }
  }
}
