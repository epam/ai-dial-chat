import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import { buildDialFileResourceUrl } from '../dial-resource-path.util';
import type {
  DiscardSharedItemDto,
  DiscardSharedResponseDto,
} from '../dto/discard-shared.dto';
import type {
  RevokeAccessItemDto,
  RevokeAccessResponseDto,
} from '../dto/revoke-access.dto';
@Injectable()
export class FilesSharingService {
  private readonly logger = new Logger(FilesSharingService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private getTimeoutMs(): number {
    return this.configService.get<number>('FILE_TRANSFER_TIMEOUT_MS') ?? 30_000;
  }

  async revokeAccess(
    items: RevokeAccessItemDto[],
    at: string,
  ): Promise<RevokeAccessResponseDto> {
    this.logger.log(`Revoke access started: itemCount=${items.length}`);

    try {
      const { error, response } =
        await this.dialClient.client.revokeSharedResources({
          headers: getBearerAuthHeaders(at),
          body: {
            resources: items.map((item) => ({
              url: buildDialFileResourceUrl(item.bucket, item.path),
            })),
          },
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        });

      if (error != null) {
        this.logger.warn(
          `Revoke access failed: itemCount=${items.length}, status=${response.status}`,
        );
        return handleDialSdkError(
          error,
          'files.revokeAccess',
          this.logger,
          response,
        );
      }

      this.logger.log(
        `Revoke access completed: itemCount=${items.length}, success=true`,
      );

      return { success: true };
    } catch (err) {
      this.logger.error(
        `Revoke access exception: itemCount=${items.length}`,
        err,
      );
      return handleDialSdkError(err, 'files.revokeAccess', this.logger);
    }
  }

  async discardShared(
    items: DiscardSharedItemDto[],
    at: string,
  ): Promise<DiscardSharedResponseDto> {
    this.logger.log(`Discard shared started: itemCount=${items.length}`);

    try {
      const { error, response } =
        await this.dialClient.client.discardSharedResources({
          headers: getBearerAuthHeaders(at),
          body: {
            resources: items.map((item) => ({
              url: buildDialFileResourceUrl(item.bucket, item.path),
            })),
          },
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        });

      if (error != null) {
        this.logger.warn(
          `Discard shared failed: itemCount=${items.length}, status=${response.status}`,
        );
        return handleDialSdkError(
          error,
          'files.discardShared',
          this.logger,
          response,
        );
      }

      this.logger.log(
        `Discard shared completed: itemCount=${items.length}, success=true`,
      );

      return { success: true };
    } catch (err) {
      this.logger.error(
        `Discard shared exception: itemCount=${items.length}`,
        err,
      );
      return handleDialSdkError(err, 'files.discardShared', this.logger);
    }
  }
}
