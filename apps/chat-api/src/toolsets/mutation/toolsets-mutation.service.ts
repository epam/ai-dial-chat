import { Injectable, Logger } from '@nestjs/common';
import {
  extractDialErrorMessage,
  handleDialFetchError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { DialClientService } from '../../dial/dial-client.service';
import { ToolsetAuthType } from '../dto/toolset-body.dto';
import type {
  MutatedToolsetDto,
  ToolsetBodyDto,
} from '../dto/toolset-body.dto';
import { ToolsetsListingService } from '../listing/toolsets-listing.service';
import {
  DEFAULT_TOOLSET_VERSION,
  TOOLSET_RESOURCE_PREFIX,
  getRawAuthSettings,
  toDialToolsetBody,
  type DialToolsetResource,
  type RawAuthSettings,
  type RawDialToolset,
} from '../utils/toolset-mapper.util';

type SaveToolSetBody = Parameters<
  DialClientService['client']['saveToolSet']
>[2]['body'];

@Injectable()
export class ToolsetsMutationService {
  private readonly logger = new Logger(ToolsetsMutationService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly listingService: ToolsetsListingService,
  ) {}

  private async tryGetCustomToolsetAuthSettings(
    authHeaders: ReturnType<typeof getBearerAuthHeaders>,
    resource: DialToolsetResource,
    toolsetName: string,
  ): Promise<RawAuthSettings | undefined> {
    const result = await this.dialClient.client.getCustomToolSet(
      resource.bucket,
      resource.path,
      { headers: authHeaders },
    );
    if (result.error) {
      this.logger.debug(
        `Skipped preserving hidden auth settings for "${toolsetName}" (status: ${result.response.status})`,
      );
      return undefined;
    }

    return getRawAuthSettings(result.data as unknown as RawDialToolset);
  }

  async createToolset(
    userSub: string,
    accessToken: string,
    body: ToolsetBodyDto,
  ): Promise<MutatedToolsetDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);

    try {
      const bucket = await this.listingService.getUserBucket(
        authHeaders,
        'get user bucket',
      );
      const version = body.version ?? DEFAULT_TOOLSET_VERSION;
      const path = encodeURIComponent(
        safeDecodeURIComponent(`${body.name}__${version}`),
      );
      const id = `${TOOLSET_RESOURCE_PREFIX}${bucket}/${path}`;

      const response = await this.dialClient.client.saveToolSet(bucket, path, {
        headers: authHeaders,
        /*
         * The SDK types `displayName`/`description` as plain `string`; DIAL
         * Core actually accepts a locale map too. Remove this cast when the
         * SDK's toolset schema is widened to match.
         */
        body: toDialToolsetBody(body, version) as unknown as SaveToolSetBody,
      });
      if (response.error) {
        this.logger.warn(
          `DIAL Core rejected create toolset: ${JSON.stringify(response.error)}`,
        );
        return mapDialHttpStatus(
          response.response.status,
          'create toolset',
          this.logger,
          response.error,
          extractDialErrorMessage(response.error),
        );
      }
      await this.listingService.invalidateCaches(userSub);
      this.logger.debug(`Created toolset ${id} (sub: ${userSub})`);
      return { id };
    } catch (err) {
      return handleDialFetchError(err, 'create toolset', this.logger, 0);
    }
  }

  async updateToolset(
    userSub: string,
    accessToken: string,
    toolsetName: string,
    body: ToolsetBodyDto,
  ): Promise<MutatedToolsetDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    const version = body.version ?? DEFAULT_TOOLSET_VERSION;

    try {
      const { bucket, path } = await this.listingService.resolveToolsetResource(
        authHeaders,
        toolsetName,
      );
      const existingAuthSettings =
        body.authSettings.authenticationType === ToolsetAuthType.OAuth
          ? await this.tryGetCustomToolsetAuthSettings(
              authHeaders,
              { bucket, path },
              toolsetName,
            )
          : undefined;
      const response = await this.dialClient.client.saveToolSet(bucket, path, {
        headers: authHeaders,
        /* See the create-path comment above on the same SDK/DIAL Core mismatch. */
        body: toDialToolsetBody(
          body,
          version,
          existingAuthSettings,
        ) as unknown as SaveToolSetBody,
      });
      if (response.error) {
        this.logger.warn(
          `DIAL Core rejected update toolset "${toolsetName}": ${JSON.stringify(response.error)}`,
        );
        return mapDialHttpStatus(
          response.response.status,
          `update toolset "${toolsetName}"`,
          this.logger,
          response.error,
          extractDialErrorMessage(response.error),
        );
      }
      await this.listingService.invalidateCaches(userSub, toolsetName);
      this.logger.debug(`Updated toolset ${toolsetName} (sub: ${userSub})`);
      return { id: toolsetName };
    } catch (err) {
      return handleDialFetchError(
        err,
        `update toolset "${toolsetName}"`,
        this.logger,
        0,
      );
    }
  }

  async deleteToolset(
    userSub: string,
    accessToken: string,
    toolsetName: string,
  ): Promise<void> {
    const authHeaders = getBearerAuthHeaders(accessToken);

    try {
      const { bucket, path } = await this.listingService.resolveToolsetResource(
        authHeaders,
        toolsetName,
      );
      const response = await this.dialClient.client.deleteToolSet(
        bucket,
        path,
        {
          headers: authHeaders,
        },
      );
      if (response.error) {
        return mapDialHttpStatus(
          response.response.status,
          `delete toolset "${toolsetName}"`,
          this.logger,
        );
      }
      await this.listingService.invalidateCaches(userSub, toolsetName);
      this.logger.debug(`Deleted toolset ${toolsetName} (sub: ${userSub})`);
    } catch (err) {
      return handleDialFetchError(
        err,
        `delete toolset "${toolsetName}"`,
        this.logger,
        0,
      );
    }
  }
}
