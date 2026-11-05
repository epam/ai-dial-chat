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
import {
  MAX_CREATE_PATH_ATTEMPTS,
  buildNextFreeLeaf,
} from '../../common/utils/next-free-path';
import {
  DEFAULT_RESOURCE_VERSION,
  ResourceIdentityTab,
  buildResourceNameConflict,
  findDuplicateIdentity,
  getResourceIdentityFolder,
  resolveDisplayedName,
  type ResourceIdentityCandidate,
} from '../../common/utils/resource-identity';
import { toResourceIdentityEntries } from '../../common/utils/resource-identity-sources';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { DeploymentsService } from '../../deployments/deployments.service';
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
    private readonly deploymentsService: DeploymentsService,
  ) {}

  /**
   * Rejects a write that would give a toolset the displayed name and version
   * of another own entity in the Toolsets tab and the same folder. Reads
   * toolsets and deployments fresh, because the duplicate may be seconds old.
   * @param userSub - session user the lists are cached under
   * @param accessToken - bearer token for DIAL Core
   * @param bucket - the caller's own bucket
   * @param candidate - identity the write is about to apply
   * @param selfId - id of the toolset being updated, skipped in the comparison
   */
  private async assertNoDuplicateIdentity(
    userSub: string,
    accessToken: string,
    bucket: string,
    candidate: ResourceIdentityCandidate,
    selfId?: string,
  ): Promise<void> {
    const [toolsets, deployments] = await Promise.all([
      this.listingService.listToolsets(userSub, accessToken, bucket, true),
      this.deploymentsService.listDeployments(
        userSub,
        accessToken,
        bucket,
        undefined,
        true,
      ),
    ]);
    const duplicate = findDuplicateIdentity({
      candidate,
      tabs: [ResourceIdentityTab.Toolsets],
      entries: toResourceIdentityEntries(
        deployments.deployments,
        toolsets.data,
      ),
      selfId,
    });
    if (duplicate) throw buildResourceNameConflict(duplicate);
  }

  /**
   * For an existing own toolset, rejects a rename, version change or move that
   * would give it the identity of another own entity in the Toolsets tab. The
   * stored identity comes from the fresh toolsets list entry matching
   * `selfId`; nothing else is read unless the identity actually changes, so a
   * description-only save costs one list read. A toolset the caller does not
   * own, or one missing from the list, is not checked.
   * @param userSub - session user the lists are cached under
   * @param accessToken - bearer token for DIAL Core
   * @param bucket - the caller's own bucket
   * @param selfId - id of the toolset being written
   * @param change - the parts of the identity the write changes; omitted parts keep their stored value
   */
  private async assertIdentityChangeAllowed(
    userSub: string,
    accessToken: string,
    bucket: string,
    selfId: string,
    change: Partial<ResourceIdentityCandidate>,
  ): Promise<void> {
    const toolsets = await this.listingService.listToolsets(
      userSub,
      accessToken,
      bucket,
      true,
    );
    const self = toolsets.data.find((item) => item.id === selfId);
    if (self?.isMy !== true) return;

    const current = {
      folder: getResourceIdentityFolder(selfId),
      name: resolveDisplayedName(self.displayName),
      version: self.displayVersion ?? DEFAULT_RESOURCE_VERSION,
    };
    const next = {
      folder: change.folder ?? current.folder,
      name: change.name?.trim() ?? current.name,
      version: change.version ?? current.version,
    };
    if (
      next.folder === current.folder &&
      next.name === current.name &&
      next.version === current.version
    ) {
      return;
    }

    const deployments = await this.deploymentsService.listDeployments(
      userSub,
      accessToken,
      bucket,
      undefined,
      true,
    );
    const duplicate = findDuplicateIdentity({
      candidate: next,
      tabs: [ResourceIdentityTab.Toolsets],
      entries: toResourceIdentityEntries(
        deployments.deployments,
        toolsets.data,
      ),
      selfId,
    });
    if (duplicate) throw buildResourceNameConflict(duplicate);
  }

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
      const folderPath = body.folderPath ?? '';
      if (body.createOnly) {
        await this.assertNoDuplicateIdentity(userSub, accessToken, bucket, {
          folder: folderPath,
          name: body.name,
          version,
        });
      }

      /*
       * The SDK types `displayName`/`description` as plain `string`; DIAL
       * Core actually accepts a locale map too. Remove this cast when the
       * SDK's toolset schema is widened to match.
       */
      const toolsetBody = toDialToolsetBody(
        body,
        version,
      ) as unknown as SaveToolSetBody;

      /*
       * The storage path never follows a rename, so a path can be held by a
       * toolset the user now sees under another name. Once the identity check
       * has passed, a create-only request moves on to the next free path
       * instead of refusing a name nothing visible owns; each try is still
       * atomic via `If-None-Match`, so no existing toolset is overwritten.
       */
      const maxAttempts = body.createOnly ? MAX_CREATE_PATH_ATTEMPTS : 1;
      let path = '';
      for (let attempt = 1; ; attempt++) {
        path = buildFolderResourcePath(
          folderPath,
          encodeURIComponent(
            safeDecodeURIComponent(
              buildNextFreeLeaf(body.name, version, attempt),
            ),
          ),
        );
        const response = await this.dialClient.client.saveToolSet(
          bucket,
          path,
          {
            headers: {
              ...authHeaders,
              ...(body.createOnly ? { 'If-None-Match': '*' } : {}),
            },
            body: toolsetBody,
          },
        );
        if (!response.error) break;
        if (body.createOnly && response.response.status === 412) {
          if (attempt < maxAttempts) continue;
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
      const id = `${TOOLSET_RESOURCE_PREFIX}${bucket}/${path}`;
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
      await this.assertIdentityChangeAllowed(
        userSub,
        accessToken,
        await this.listingService.getUserBucket(authHeaders, 'get user bucket'),
        `${TOOLSET_RESOURCE_PREFIX}${bucket}/${path}`,
        { name: body.name, version },
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
        await this.assertIdentityChangeAllowed(
          userSub,
          accessToken,
          bucket,
          `${TOOLSET_RESOURCE_PREFIX}${source.bucket}/${source.path}`,
          { folder: folderPath },
        );
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
    } catch (err) {
      return handleDialFetchError(err, context, this.logger, 0);
    }
    // The move already succeeded; a cache failure must not report it as failed.
    try {
      await this.listingService.invalidateCaches(userSub, toolsetName);
    } catch (err) {
      handleDialFetchError(
        err,
        `invalidate caches after ${context} (sub: ${userSub})`,
        this.logger,
        0,
        { swallow: true },
      );
    }
    this.logger.debug(
      `Moved toolset ${toolsetName} to ${id} (sub: ${userSub})`,
    );
    return { id };
  }
}
