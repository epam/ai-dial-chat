import { Injectable, Logger } from '@nestjs/common';
import {
  extractDialErrorMessage,
  handleDialFetchError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { DialClientService } from '../../dial/dial-client.service';
import type {
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from '../dto/toolset-auth.dto';
import { ToolsetsListingService } from '../listing/toolsets-listing.service';
import {
  toDialToolsetSigninBody,
  toDialToolsetSignoutBody,
} from '../utils/toolset-mapper.util';

@Injectable()
export class ToolsetsAuthService {
  private readonly logger = new Logger(ToolsetsAuthService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly listingService: ToolsetsListingService,
  ) {}

  async loginToolset(
    userSub: string,
    accessToken: string,
    toolsetName: string,
    body: ToolsetLoginBodyDto,
  ): Promise<void> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    this.logger.debug(
      `loginToolset raw input — path toolsetName: "${toolsetName}", body.url: "${body.url}"`,
    );
    // NOTE: never log apiKey / code — only the toolset reference and level.
    const dialBody = toDialToolsetSigninBody(body, toolsetName);
    this.logger.debug(
      `Signing in toolset "${toolsetName}": ${JSON.stringify({
        url: dialBody.url,
        credentialsLevel: dialBody.credentialsLevel,
        authenticationType: dialBody.authenticationType,
        redirectUri:
          'redirectUri' in dialBody ? dialBody.redirectUri : undefined,
        codeLength: 'code' in dialBody ? dialBody.code?.length : undefined,
      })}`,
    );

    try {
      const response = await this.dialClient.client.toolsetSignin({
        headers: authHeaders,
        body: dialBody,
      });
      if (response.error) {
        return mapDialHttpStatus(
          response.response.status,
          `log in toolset "${toolsetName}"`,
          this.logger,
          response.error,
          extractDialErrorMessage(response.error),
        );
      }
      await this.listingService.invalidateCaches(userSub, toolsetName);
      this.logger.debug(`Logged in toolset ${toolsetName} (sub: ${userSub})`);
    } catch (err) {
      return handleDialFetchError(
        err,
        `log in toolset "${toolsetName}"`,
        this.logger,
        0,
      );
    }
  }

  async logoutToolset(
    userSub: string,
    accessToken: string,
    bucket: string,
    toolsetName: string,
    body: ToolsetLogoutBodyDto,
  ): Promise<void> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    /*
     * A caller that only has the toolset id (e.g. a logout requested from a
     * QuickApps iframe, which never loaded the toolset's own auth config)
     * can omit `authenticationType` — look up the toolset's own stored value
     * instead of requiring every caller to already have it loaded.
     */
    const authenticationType =
      body.authenticationType ??
      (
        await this.listingService.getToolset(
          userSub,
          accessToken,
          bucket,
          toolsetName,
        )
      ).authSettings?.authenticationType;
    this.logger.debug(
      `logoutToolset raw input — path toolsetName: "${toolsetName}", body.url: "${body.url}"`,
    );
    const dialBody = toDialToolsetSignoutBody(
      body,
      authenticationType,
      toolsetName,
    );
    this.logger.debug(
      `Signing out toolset "${toolsetName}": url "${dialBody.url}"`,
    );

    try {
      const response = await this.dialClient.client.toolSetSignout({
        headers: authHeaders,
        body: dialBody,
      });
      /*
       * DIAL Core returns 404 from signout when there is no credential left
       * at the requested level to revoke — the toolset itself already
       * resolved via `authHeaders`/prior calls, so this only means "already
       * signed out". Treat it as the idempotent success it represents
       * instead of surfacing a "failed to log out" error for a state the
       * user already wanted.
       */
      if (response.error && response.response.status !== 404) {
        return mapDialHttpStatus(
          response.response.status,
          `log out toolset "${toolsetName}"`,
          this.logger,
        );
      }
      await this.listingService.invalidateCaches(userSub, toolsetName);
      this.logger.debug(`Logged out toolset ${toolsetName} (sub: ${userSub})`);
    } catch (err) {
      return handleDialFetchError(
        err,
        `log out toolset "${toolsetName}"`,
        this.logger,
        0,
      );
    }
  }
}
