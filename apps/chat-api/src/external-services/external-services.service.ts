import { Injectable, Logger } from '@nestjs/common';
import {
  extractDialErrorMessage,
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { DialClientService } from '../dial/dial-client.service';
import type {
  ExternalServiceLogoutBodyDto,
  ExternalServiceSigninBodyDto,
  GetExternalServiceResponseDto,
} from './dto/external-service.dto';
import {
  mapDialExternalServiceToDto,
  toDialExternalServiceAppId,
  toDialExternalServiceSigninBody,
  toDialExternalServiceSignoutBody,
} from './external-services.mapper';

/**
 * Proxies DIAL Core's application external-service operations
 * (`GET /v1/applications/{appId}/external-services/{id}`,
 * `POST /v1/ops/external-service/signin|signout`) for the mid-completion
 * `external-service/signin` interrupt. Mirrors `ToolsetsService`'s
 * login/logout logging discipline — never logs `apiKey`/`code` values.
 */
@Injectable()
export class ExternalServicesService {
  private readonly logger = new Logger(ExternalServicesService.name);

  constructor(private readonly dialClient: DialClientService) {}

  async getExternalService(
    accessToken: string,
    appId: string,
    serviceId: string,
  ): Promise<GetExternalServiceResponseDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    this.logger.debug(
      `Fetching external service "${serviceId}" for app "${appId}"`,
    );

    try {
      const response = await this.dialClient.client.getExternalService(
        toDialExternalServiceAppId(appId),
        serviceId,
        { headers: authHeaders },
      );
      this.logger.debug(
        `DIAL Core external service response for "${serviceId}" (app "${appId}"): ${JSON.stringify(response.data)}`,
      );
      if (response.error) {
        return mapDialHttpStatus(
          response.response.status,
          `get external service "${serviceId}"`,
          this.logger,
          response.error,
          extractDialErrorMessage(response.error),
        );
      }

      return mapDialExternalServiceToDto(response.data);
    } catch (err) {
      return handleDialFetchError(
        err,
        `get external service "${serviceId}"`,
        this.logger,
        0,
      );
    }
  }

  async signIn(
    accessToken: string,
    appId: string,
    serviceId: string,
    body: ExternalServiceSigninBodyDto,
  ): Promise<void> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    const dialBody = toDialExternalServiceSigninBody(appId, serviceId, body);
    this.logger.debug(
      `Signing in external service "${serviceId}" (app "${appId}"): ${JSON.stringify(
        {
          url: dialBody.url,
          credentialsLevel: dialBody.credentialsLevel,
          authenticationType: dialBody.authenticationType,
          redirectUri:
            'redirectUri' in dialBody ? dialBody.redirectUri : undefined,
          codeLength: 'code' in dialBody ? dialBody.code?.length : undefined,
        },
      )}`,
    );

    try {
      const response = await this.dialClient.client.externalServiceSignIn({
        headers: authHeaders,
        body: dialBody,
      });
      if (response.error) {
        return mapDialHttpStatus(
          response.response.status,
          `sign in external service "${serviceId}"`,
          this.logger,
          response.error,
          extractDialErrorMessage(response.error),
        );
      }
      if (!response.data) {
        return mapDialHttpStatus(
          502,
          `sign in external service "${serviceId}" (Core reported failure)`,
          this.logger,
        );
      }
      this.logger.debug(
        `Signed in external service ${serviceId} (app ${appId})`,
      );
    } catch (err) {
      return handleDialFetchError(
        err,
        `sign in external service "${serviceId}"`,
        this.logger,
        0,
      );
    }
  }

  async signOut(
    accessToken: string,
    appId: string,
    serviceId: string,
    body: ExternalServiceLogoutBodyDto,
  ): Promise<void> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    const dialBody = toDialExternalServiceSignoutBody(appId, serviceId, body);
    this.logger.debug(
      `Signing out external service "${serviceId}" (app "${appId}"): url "${dialBody.url}"`,
    );

    try {
      const response = await this.dialClient.client.externalServiceSignOut({
        headers: authHeaders,
        body: dialBody,
      });
      /*
       * Mirrors ToolsetsService.logoutToolset: a 404 here means there was no
       * credential left to revoke at this level, which is the idempotent
       * success state a sign-out call wants, not an error.
       */
      if (response.error && response.response.status !== 404) {
        return mapDialHttpStatus(
          response.response.status,
          `sign out external service "${serviceId}"`,
          this.logger,
          response.error,
          extractDialErrorMessage(response.error),
        );
      }
      this.logger.debug(
        `Signed out external service ${serviceId} (app ${appId})`,
      );
    } catch (err) {
      return handleDialFetchError(
        err,
        `sign out external service "${serviceId}"`,
        this.logger,
        0,
      );
    }
  }
}
