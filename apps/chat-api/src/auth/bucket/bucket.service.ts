import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { DialClientService } from '../../dial/dial-client.service';

@Injectable()
export class BucketService {
  private readonly logger = new Logger(BucketService.name);

  constructor(private readonly dialClient: DialClientService) {}

  async getUserBucket(
    token: string,
  ): Promise<{ bucket: string; appdata?: string }> {
    this.logger.debug('Requesting user bucket from DIAL Core');
    try {
      const { data, error, response } =
        await this.dialClient.client.getUserBucket({
          headers: getBearerAuthHeaders(token),
        });
      this.logger.debug(
        'Received response from DIAL Core for getUserBucket',
        error,
      );

      if (error != null || !data) {
        this.logger.debug(
          'getUserBucket returned error response from DIAL Core',
        );
        return handleDialSdkError(
          error,
          'bucket.getUserBucket',
          this.logger,
          response,
        );
      }

      if (data.bucket == null) {
        this.logger.error('DIAL Core getUserBucket response has no bucket');
        throw new BadGatewayException('DIAL Core returned no bucket');
      }

      this.logger.debug(`getUserBucket succeeded, bucket=${data.bucket}`);
      return { bucket: data.bucket, appdata: data.appdata };
    } catch (error) {
      this.logger.error('DIAL Core rejected getUserBucket', error);
      return handleDialSdkError(error, 'bucket.getUserBucket', this.logger);
    }
  }
}
