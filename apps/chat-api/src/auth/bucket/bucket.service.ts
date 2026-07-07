import { Injectable, Logger } from '@nestjs/common';
import { AppService } from '../../app/app.service';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';

@Injectable()
export class BucketService extends AppService {
  protected override logger = new Logger(BucketService.name);

  async getUserBucket(
    token: string,
  ): Promise<{ bucket: string; appdata?: string }> {
    this.logger.debug('Requesting user bucket from DIAL Core');
    try {
      const { data, error } = (await this.client.getUserBucket({
        headers: getBearerAuthHeaders(token),
      })) as {
        data?: { bucket: string; appdata?: string };
        error?: unknown;
      };
      this.logger.debug(
        'Received response from DIAL Core for getUserBucket',
        error,
      );

      if (error != null || !data) {
        this.logger.debug(
          'getUserBucket returned error response from DIAL Core',
        );
        return handleDialSdkError(error, 'bucket.getUserBucket', this.logger);
      }

      this.logger.debug(`getUserBucket succeeded, bucket=${data.bucket}`);
      return data;
    } catch (error) {
      this.logger.error('DIAL Core rejected getUserBucket', error);
      return handleDialSdkError(error, 'bucket.getUserBucket', this.logger);
    }
  }
}
