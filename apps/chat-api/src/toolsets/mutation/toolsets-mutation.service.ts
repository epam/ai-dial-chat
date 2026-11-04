import { ConflictException, Injectable, Logger } from '@nestjs/common';
import {
  extractDialErrorMessage,
  handleDialFetchError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import type {
  ResourceFoldersResponseDto,
  ResourceIdResponseDto,
} from '../../common/dto/resource-folder.dto';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import {
  DialResourceType,
  assertOwnBucket,
  buildFolderResourcePath,
  getResourceLeaf,
  listDialResourceFolders,
  transferDialResource,
} from '../../common/utils/dial-resource-transfer';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { DialClientService } from '../../dial/dial-client.service';
import { ToolsetAuthType } from '../dto/toolset-body.dto';
import type {
  CreateToolsetBodyDto,
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
    body: CreateToolsetBodyDto,
  ): Promise<MutatedToolsetDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);

    try {
      const bucket = await this.listingService.getUserBucket(
        authHeaders,
        'get user bucket',
      );
      const version = body.version ?? DEFAULT_TOOLSET_VERSION;
      const path = buildFolderResourcePath(
        body.folderPath ?? '',
        encodeURIComponent(safeDecodeURIComponent(`${body.name}__${version}`)),
      );
      const id = `${TOOLSET_RESOURCE_PREFIX}${bucket}/${path}`;

      const response = await this.dialClient.client.saveToolSet(bucket, path, {
        headers: {
          ...authHeaders,
          ...(body.createOnly ? { 'If-None-Match': '*' } : {}),
        },
        /*
         * The SDK types `displayName`/`description` as plain `string`; DIAL
         * Core actually accepts a locale map too. Remove this cast when the
         * SDK's toolset schema is widened to match.
         */
        body: toDialToolsetBody(body, version) as unknown as SaveToolSetBody,
      });
      if (response.error) {
        if (body.createOnly && response.response.status === 412) {
          throw new ConflictException('Toolset version already exists');
        }
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

  async listToolsetFolders(
    accessToken: string,
    folderPath: string,
  ): Promise<ResourceFoldersResponseDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    try {
      const bucket = await this.listingService.getUserBucket(
        authHeaders,
        'get user bucket',
      );
      const folders = await listDialResourceFolders(
        this.dialClient.client,
        DialResourceType.Toolsets,
        authHeaders,
        bucket,
        folderPath,
        this.logger,
      );
      return { folders };
    } catch (err) {
      return handleDialFetchError(err, 'list toolset folders', this.logger, 0);
    }
  }

  /**
   * Moves a toolset in the caller's own bucket into `folderPath`, never
   * overwriting. Only resource urls cross the wire: auth settings and
   * secrets are neither read nor logged.
   */
  async moveToolset(
    userSub: string,
    accessToken: string,
    toolsetName: string,
    folderPath: string,
  ): Promise<ResourceIdResponseDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    const context = `move toolset "${toolsetName}"`;
    let id: string;
    try {
      const bucket = await this.listingService.getUserBucket(
        authHeaders,
        'get user bucket',
      );
      const source = await this.listingService.resolveToolsetResource(
        authHeaders,
        toolsetName,
      );
      assertOwnBucket(source, bucket);
      const destination = {
        bucket,
        path: buildFolderResourcePath(folderPath, getResourceLeaf(source.path)),
      };
      if (destination.path !== source.path) {
        await transferDialResource({
          client: this.dialClient.client,
          operation: 'moveResource',
          type: DialResourceType.Toolsets,
          headers: authHeaders,
          source,
          destination,
          context,
          logger: this.logger,
        });
      }
      id = `${TOOLSET_RESOURCE_PREFIX}${bucket}/${destination.path}`;
      await this.listingService.invalidateCaches(userSub, toolsetName);
    } catch (err) {
      return handleDialFetchError(err, context, this.logger, 0);
    }
    this.logger.debug(
      `Moved toolset ${toolsetName} to ${id} (sub: ${userSub})`,
    );
    return { id };
  }
}
