import { Injectable, Logger } from '@nestjs/common';
import {
  extractDialErrorMessage,
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { DialClientService } from '../dial/dial-client.service';
import type {
  GetOfflineCredentialsResponseDto,
  OfflineCredentialsSigninBodyDto,
} from './dto/offline-credentials.dto';
import {
  mapDialOfflineCredentialsToDto,
  toDialOfflineCredentialsSigninBody,
} from './offline-credentials.mapper';

/**
 * Proxies DIAL Core's per-user offline-credentials operations
 * (`GET /v1/user/offline-credentials`,
 * `POST /v1/user/offline-credentials/signin`) for the Scheduled Tasks
 * proactive-consent flow. Mirrors `ExternalServicesService`'s call pattern
 * and logging discipline — never logs the authorization `code` itself.
 */
@Injectable()
export class OfflineCredentialsService {
  private readonly logger = new Logger(OfflineCredentialsService.name);

  constructor(private readonly dialClient: DialClientService) {}

  async getOfflineCredentialsStatus(
    accessToken: string,
  ): Promise<GetOfflineCredentialsResponseDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    this.logger.debug('Fetching offline-credentials status');

    try {
      const response = await this.dialClient.client.getOfflineCredentials({
        headers: authHeaders,
      });
      if (response.error) {
        this.logger.debug(
          `DIAL Core offline-credentials status error: status=${response.response.status} body=${JSON.stringify(response.error)}`,
        );
        return mapDialHttpStatus(
          response.response.status,
          'get offline-credentials status',
          this.logger,
          response.error,
          extractDialErrorMessage(response.error),
        );
      }

      this.logger.debug(
        `DIAL Core offline-credentials status raw response: ${JSON.stringify(response.data)}`,
      );
      const mapped = mapDialOfflineCredentialsToDto(response.data);
      this.logger.debug(
        `Mapped offline-credentials status: ${JSON.stringify(mapped)}`,
      );
      return mapped;
    } catch (err) {
      return handleDialFetchError(
        err,
        'get offline-credentials status',
        this.logger,
        0,
      );
    }
  }

  async signIn(
    accessToken: string,
    body: OfflineCredentialsSigninBodyDto,
  ): Promise<void> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    const dialBody = toDialOfflineCredentialsSigninBody(body);
    this.logger.debug(
      `Signing in offline-credentials: ${JSON.stringify({
        redirectUri: dialBody.redirectUri,
        codeLength: dialBody.code?.length,
      })}`,
    );

    try {
      const response = await this.dialClient.client.offlineCredentialsSignIn({
        headers: authHeaders,
        body: dialBody,
      });
      if (response.error) {
        return mapDialHttpStatus(
          response.response.status,
          'sign in offline-credentials',
          this.logger,
          response.error,
          extractDialErrorMessage(response.error),
        );
      }
      if (!response.data) {
        return mapDialHttpStatus(
          502,
          'sign in offline-credentials (Core reported failure)',
          this.logger,
        );
      }
      this.logger.debug('Signed in offline-credentials');
    } catch (err) {
      return handleDialFetchError(
        err,
        'sign in offline-credentials',
        this.logger,
        0,
      );
    }
  }
}
