import type { components } from '@epam/ai-dial-typescript-sdk';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import type {
  ResourceFoldersResponseDto,
  ResourceIdResponseDto,
} from '../common/dto/resource-folder.dto';
import type { LocalizedText } from '../common/types/localized-text';
import { isQuickAppSchema } from '../common/utils/application-schema';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import {
  composeLocalizedFields,
  toLocalizedValue,
} from '../common/utils/compose-localized-fields';
import {
  parseDialApplicationResource,
  type DialApplicationResource,
} from '../common/utils/dial-application-resource';
import {
  DialResourceType,
  assertOwnBucket,
  buildFolderResourcePath,
  getResourceLeaf,
  listDialResourceFolders,
  transferDialResource,
} from '../common/utils/dial-resource-transfer';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import {
  MAX_CREATE_PATH_ATTEMPTS,
  RESOURCE_VERSION_SEPARATOR,
  buildNextFreeLeaf,
} from '../common/utils/next-free-path';
import {
  DEFAULT_RESOURCE_VERSION,
  ResourceIdentityKind,
  ResourceIdentityTab,
  getResourceIdentityFolder,
  getResourceIdentityTabs,
  resolveDisplayedName,
} from '../common/utils/resource-identity';
import { DeploymentsService } from '../deployments/deployments.service';
import { DeploymentsDetailsService } from '../deployments/details/deployments-details.service';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import { ResourceIdentityService } from '../resource-identity/resource-identity.service';
import type {
  CommitApplicationVersionDto,
  ForkApplicationVersionDto,
} from './dto/application-version.dto';
import type { ApplicationsResponseDto } from './dto/application.dto';
import type {
  CreateApplicationBodyDto,
  CreatedApplicationDto,
} from './dto/create-application.dto';
import type {
  UpdateApplicationBodyDto,
  UpdatedApplicationDto,
} from './dto/update-application.dto';
import {
  getStoredDisplayName,
  getStoredDisplayVersion,
  hoistApplicationFields,
  withDisplayName,
  withDisplayVersion,
} from './utils/application-body-mapping';
import { throwApplicationSaveError } from './utils/application-save-error';

type DialApplication = components['schemas']['Application'];

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly deploymentsService: DeploymentsService,
    private readonly deploymentsDetailsService: DeploymentsDetailsService,
    private readonly identityService: ResourceIdentityService,
  ) {}

  /**
   * Rejects a write that would give an application the displayed name and
   * version of another own entity in the same folder and a shared catalog tab.
   * A new application competes as an agent; an existing one competes in the
   * tabs its `interfaces` place it in, read from its entry in the deployments
   * list (a stored body carries none). A name or version the write does not set
   * is taken from that entry, and an application the caller does not own is not
   * checked.
   * @param userSub - session user the lists are cached under
   * @param accessToken - bearer token for DIAL Core
   * @param bucket - the caller's own bucket
   * @param candidate - folder, and the name and version when the write sets them
   * @param sourceId - id of the existing application the write starts from, if any
   * @param excludeSource - skip the source itself in the comparison (an update
   *   or move rewrites it; a fork leaves it in place beside the new copy)
   */
  private async assertNoDuplicateIdentity(
    userSub: string,
    accessToken: string,
    bucket: string,
    candidate: { folder: string; name?: string; version?: string },
    sourceId?: string,
    excludeSource = true,
  ): Promise<void> {
    const deployments = await this.identityService.listFreshDeployments(
      userSub,
      accessToken,
      bucket,
    );
    const source =
      sourceId == null
        ? undefined
        : deployments.find((item) => item.id === sourceId);
    if (source?.isMy === false) return;

    const name =
      candidate.name ??
      (source == null ? undefined : resolveDisplayedName(source.displayName));
    if (name == null) return;

    await this.identityService.assertUnique({
      userSub,
      accessToken,
      bucket,
      candidate: {
        folder: candidate.folder,
        name,
        version:
          candidate.version ??
          source?.displayVersion ??
          DEFAULT_RESOURCE_VERSION,
      },
      tabs: source
        ? getResourceIdentityTabs(
            ResourceIdentityKind.Application,
            source.interfaces,
          )
        : [ResourceIdentityTab.Agents],
      selfId: excludeSource ? sourceId : undefined,
      deployments,
    });
  }

  private async getUserBucket(
    authHeaders: ReturnType<typeof getBearerAuthHeaders>,
    context: string,
  ): Promise<string> {
    const result = await this.dialClient.client.getUserBucket({
      headers: authHeaders,
    });
    if (result.error) {
      return mapDialHttpStatus(result.response.status, context, this.logger);
    }
    const { bucket } = result.data ?? {};
    if (bucket == null) {
      throw new BadGatewayException('DIAL Core returned an empty bucket');
    }
    return bucket;
  }

  private async resolveApplicationResource(
    authHeaders: ReturnType<typeof getBearerAuthHeaders>,
    applicationName: string,
  ): Promise<DialApplicationResource> {
    const resource = parseDialApplicationResource(applicationName);
    if (resource != null) {
      return resource;
    }

    return {
      bucket: await this.getUserBucket(authHeaders, 'get user bucket'),
      path: encodeDialResourcePath(applicationName),
    };
  }

  async listApplications(
    userSub: string,
    accessToken: string,
  ): Promise<ApplicationsResponseDto> {
    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: `applications:list:${userSub}`,
      ttlMs: 30 * 1000,
      context: 'list applications',
      logger: this.logger,
      fetch: async () => {
        const result = await this.dialClient.client.getApplications({
          headers: getBearerAuthHeaders(accessToken),
        });
        if (result.error) {
          return mapDialHttpStatus(
            result.response.status,
            'list applications',
            this.logger,
          );
        }
        return {
          data:
            (result.data as { data?: ApplicationsResponseDto['data'] }).data ??
            [],
        };
      },
    });
  }

  async createApplication(
    userSub: string,
    accessToken: string,
    body: CreateApplicationBodyDto,
  ): Promise<CreatedApplicationDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    const cacheKey = `applications:list:${userSub}`;

    try {
      const bucketResponse = await this.dialClient.client.getUserBucket({
        headers: authHeaders,
      });
      if (bucketResponse.error) {
        return mapDialHttpStatus(
          bucketResponse.response.status,
          'get user bucket',
          this.logger,
        );
      }
      const { bucket } = bucketResponse.data ?? {};
      if (bucket == null) {
        throw new BadGatewayException('DIAL Core returned an empty bucket');
      }

      const version = body.version ?? DEFAULT_RESOURCE_VERSION;

      const assertUnique = () =>
        this.assertNoDuplicateIdentity(userSub, accessToken, bucket, {
          folder: body.folderPath ?? '',
          name: body.name,
          version,
        });
      if (body.createOnly) await assertUnique();

      const {
        endpoint,
        features,
        inputAttachmentTypes,
        maxInputAttachments,
        remainingProperties,
      } = body.preserveApplicationProperties
        ? { remainingProperties: body.applicationProperties ?? {} }
        : hoistApplicationFields(body.applicationProperties);

      const { displayName, description } = composeLocalizedFields(
        body.name,
        body.description,
        body.locales,
        body.primaryLocale,
      );
      const dialBody: DialApplication = {
        displayName: toLocalizedValue(displayName),
        displayVersion: version,
      };
      if (body.type) dialBody.application_type_schema_id = body.type;
      if (Object.keys(remainingProperties).length > 0)
        dialBody.application_properties = remainingProperties;
      if (description != null)
        dialBody.description = description as unknown as string;
      if (body.iconUrl != null) dialBody.iconUrl = body.iconUrl;
      if (body.topics != null && body.topics.length > 0)
        dialBody.descriptionKeywords = body.topics;
      if (endpoint != null) dialBody.endpoint = endpoint;
      const effectiveFeatures = body.features ?? features;
      if (effectiveFeatures != null)
        dialBody.features = effectiveFeatures as (typeof dialBody)['features'];
      /*
       * Quick App creation has no `skills_supported` UI control in chat (unlike
       * the Admin app, which exposes one), so a chat-created Quick App would
       * otherwise never get the flag set and silently lose skills. Rather than
       * push this into every individual Quick App implementation or leave
       * skills broken, the BFF force-sets it here whenever the schema is a
       * Quick App — a deliberate coupling of generic application-write logic
       * to Quick-App-specific business rules, accepted as the least-bad of
       * those three options.
       *
       * `system_prompt_supported` is also written as `false` on creation only:
       * DIAL Core treats an unset flag as supported, so without it the chat
       * shows the system prompt field for a Quick App whose prompt is owned by
       * its orchestrator config. Updates leave it untouched. Explicit top-level
       * `features` are stored as supplied (e.g. copied from a template that
       * leaves the flag unset), so the default applies only without them.
       */
      if (isQuickAppSchema(body.type)) {
        dialBody.features = {
          ...(body.features == null ? { system_prompt_supported: false } : {}),
          ...dialBody.features,
          skills_supported: true,
        } as (typeof dialBody)['features'];
      }
      const attachmentTypes = body.inputAttachmentTypes ?? inputAttachmentTypes;
      const attachmentLimit = body.maxInputAttachments ?? maxInputAttachments;
      if (attachmentTypes != null)
        dialBody.inputAttachmentTypes = attachmentTypes;
      if (attachmentLimit != null)
        dialBody.maxInputAttachments = attachmentLimit;

      /*
       * The storage path is derived from the name at creation and never
       * follows a later rename, so a path can be held by an app the user now
       * sees under another name. Instead of rejecting a name nothing visible
       * owns, a create-only request moves on to the next free path; each try
       * is still atomic via `If-None-Match`, so no existing app is overwritten.
       * A `412` can also mean a concurrent create just took the same identity,
       * so the check runs again on fresh lists before the next candidate and
       * only a path held under a different identity moves on.
       */
      const maxAttempts = body.createOnly ? MAX_CREATE_PATH_ATTEMPTS : 1;
      let appPath = '';
      let encodedPath = '';
      for (let attempt = 1; ; attempt++) {
        appPath = buildNextFreeLeaf(body.name, version, attempt);
        encodedPath = buildFolderResourcePath(
          body.folderPath ?? '',
          encodeURIComponent(appPath),
        );
        const response = await this.dialClient.client.saveCustomApplication(
          bucket,
          encodedPath,
          {
            headers: {
              ...authHeaders,
              ...(body.createOnly ? { 'If-None-Match': '*' } : {}),
            },
            body: dialBody,
          },
        );
        if (!response.error) break;
        if (body.createOnly && response.response.status === 412) {
          await assertUnique();
          if (attempt < maxAttempts) continue;
          throw new ConflictException('Application name already taken');
        }
        return throwApplicationSaveError(
          response.response.status,
          response.error,
          'create application',
          this.logger,
        );
      }

      /*
       * The DIAL Core create already succeeded above — a cache-layer hiccup
       * here must not turn a successful create into an error response, so
       * it's logged and swallowed rather than propagated.
       */
      try {
        await Promise.all([
          this.cacheManager.del(cacheKey),
          this.deploymentsService.invalidateListCache(userSub),
        ]);
        this.logger.debug(
          `Created application ${appPath}, invalidated applications list and deployments list caches for sub: ${userSub}`,
        );
      } catch (err) {
        handleDialFetchError(
          err,
          `invalidate list caches after creating application "${appPath}" (sub: ${userSub})`,
          this.logger,
          0,
          { swallow: true },
        );
      }

      return { id: `applications/${bucket}/${encodedPath}` };
    } catch (err) {
      return handleDialFetchError(err, 'create application', this.logger, 0);
    }
  }

  async updateApplication(
    userSub: string,
    accessToken: string,
    applicationName: string,
    body: UpdateApplicationBodyDto,
  ): Promise<UpdatedApplicationDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    let bucket: string;
    let path: string;

    try {
      ({ bucket, path } = await this.resolveApplicationResource(
        authHeaders,
        applicationName,
      ));

      const existingResponse =
        await this.dialClient.client.getCustomApplication(bucket, path, {
          headers: authHeaders,
        });
      if (existingResponse.error) {
        return mapDialHttpStatus(
          existingResponse.response.status,
          `get application "${applicationName}"`,
          this.logger,
        );
      }

      const stored = existingResponse.data as DialApplication;
      /*
       * A stored display name is a string or a locale map; the SDK types it
       * narrower than DIAL Core writes it, so it is widened here.
       */
      const storedName = resolveDisplayedName(
        getStoredDisplayName(stored) as LocalizedText,
      );
      const storedVersion =
        getStoredDisplayVersion(stored) ?? DEFAULT_RESOURCE_VERSION;
      const nextVersion = body.version ?? storedVersion;
      if (body.name.trim() !== storedName || nextVersion !== storedVersion) {
        const applicationId = `applications/${bucket}/${path}`;
        await this.assertNoDuplicateIdentity(
          userSub,
          accessToken,
          await this.getUserBucket(authHeaders, 'get user bucket'),
          {
            folder: getResourceIdentityFolder(applicationId),
            name: body.name,
            version: nextVersion,
          },
          applicationId,
        );
      }

      /*
       * `application_type_schema_id` is never in the body and is always
       * carried through unchanged, so this update can never mutate an
       * application's schema type. `application_properties` is carried
       * through unchanged unless the body supplies `applicationProperties`,
       * in which case it is fully replaced below.
       */
      const { displayName, description } = composeLocalizedFields(
        body.name,
        body.description,
        body.locales,
        body.primaryLocale,
      );
      /*
       * The name is a full replacement, not a per-locale merge with whatever
       * the existing resource had — consistent with every other General-step
       * field. The stored `display_name` is dropped so it cannot shadow it.
       */
      let mergedBody: DialApplication = withDisplayName(
        stored,
        toLocalizedValue(displayName),
      );
      if (description != null)
        mergedBody.description = description as unknown as string;
      /*
       * An empty `iconUrl` is an explicit clear: the key is dropped from the
       * merged body so the fully replaced resource no longer carries an icon.
       * Omitted or `null` keeps the stored icon, like every other field here.
       */
      if (body.iconUrl === '') delete mergedBody.iconUrl;
      else if (body.iconUrl != null) mergedBody.iconUrl = body.iconUrl;
      if (body.topics != null && body.topics.length > 0) {
        mergedBody.descriptionKeywords = body.topics;
      }
      if (body.version != null)
        mergedBody = withDisplayVersion(mergedBody, body.version);
      if (body.endpoint != null) mergedBody.endpoint = body.endpoint;
      if (body.features != null)
        mergedBody.features = body.features as (typeof mergedBody)['features'];
      if (body.inputAttachmentTypes != null)
        mergedBody.inputAttachmentTypes = body.inputAttachmentTypes;
      if (body.maxInputAttachments != null)
        mergedBody.maxInputAttachments = body.maxInputAttachments;
      /*
       * Same rationale as `createApplication` above: chat has no UI control
       * for `skills_supported`, so every update to a Quick App re-asserts the
       * flag, regardless of whether this request body touches `features` at
       * all — it's a standing guarantee, not a one-time default set only on
       * creation.
       */
      if (isQuickAppSchema(mergedBody.application_type_schema_id)) {
        mergedBody.features = {
          ...mergedBody.features,
          skills_supported: true,
        } as (typeof mergedBody)['features'];
      }

      /*
       * `applicationProperties` fully replaces the stored
       * `application_properties` when supplied (including `{}` — a
       * deliberate clear), rather than being merged with the previous
       * value — see the `applications-write-api` spec's "applicationProperties
       * replacement semantics". Unlike `createApplication`, this is stored
       * verbatim with NO hoisting of endpoint/features/inputAttachmentTypes/
       * maxInputAttachments out of it: a Quick App's own `application_properties`
       * may itself carry a schema-specific `features` key (e.g. `timestamp`),
       * and hoisting would silently move that key to the top-level DIAL Core
       * `features` field, destroying it. A caller that wants to set the
       * top-level fields uses this DTO's own separate `endpoint`/`features`/
       * `inputAttachmentTypes`/`maxInputAttachments` properties (handled
       * above), not `applicationProperties`.
       */
      if (body.applicationProperties != null) {
        mergedBody.application_properties = body.applicationProperties;
      }

      const saveResponse = await this.dialClient.client.saveCustomApplication(
        bucket,
        path,
        {
          headers: authHeaders,
          body: mergedBody,
        },
      );

      if (saveResponse.error) {
        return throwApplicationSaveError(
          saveResponse.response.status,
          saveResponse.error,
          `update application "${applicationName}"`,
          this.logger,
        );
      }
    } catch (err) {
      return handleDialFetchError(
        err,
        `update application "${applicationName}"`,
        this.logger,
        0,
      );
    }

    /*
     * The DIAL Core update already succeeded above — a cache-layer hiccup
     * here must not turn a successful update into an error response, so it's
     * logged and swallowed rather than propagated.
     */
    try {
      await this.cacheManager.del(`applications:list:${userSub}`);
      await this.deploymentsService.invalidateListCache(userSub);
      /*
       * `GET .../details` caches the mapped DeploymentDetailsDto (including
       * application_properties) for up to 60 s under this same applicationName
       * as its `deployment` key. Without invalidating it here, re-opening Edit
       * right after a save could load the pre-update configuration and write
       * it straight back, silently reverting the just-saved change.
       */
      await this.deploymentsDetailsService.invalidateDetailsCache(
        userSub,
        applicationName,
      );
      this.logger.debug(
        `Updated application ${applicationName}, invalidated applications list, deployments list, and deployment details caches (sub: ${userSub})`,
      );
    } catch (err) {
      handleDialFetchError(
        err,
        `invalidate list/details caches after updating application "${applicationName}" (sub: ${userSub})`,
        this.logger,
        0,
        { swallow: true },
      );
    }

    return { id: `applications/${bucket}/${path}` };
  }

  async deleteApplication(
    userSub: string,
    accessToken: string,
    applicationName: string,
  ): Promise<void> {
    const authHeaders = getBearerAuthHeaders(accessToken);

    try {
      const { bucket, path } = await this.resolveApplicationResource(
        authHeaders,
        applicationName,
      );
      const response = await this.dialClient.client.deleteCustomApplication(
        bucket,
        path,
        {
          headers: authHeaders,
        },
      );
      if (response.error) {
        return mapDialHttpStatus(
          response.response.status,
          `delete application "${applicationName}"`,
          this.logger,
        );
      }
    } catch (err) {
      return handleDialFetchError(
        err,
        `delete application "${applicationName}"`,
        this.logger,
        0,
      );
    }

    /*
     * The DIAL Core delete already succeeded above — a cache-layer hiccup
     * here must not turn a successful delete into an error response, so it's
     * logged and swallowed rather than propagated.
     */
    try {
      await this.cacheManager.del(`applications:list:${userSub}`);
      await this.deploymentsService.invalidateListCache(userSub);
      this.logger.debug(
        `Deleted application ${applicationName}, invalidated applications and deployments list caches (sub: ${userSub})`,
      );
    } catch (err) {
      this.logger.warn(
        `Deleted application ${applicationName} but failed to invalidate list caches (sub: ${userSub}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Resolves `applicationName` to a resource in the caller's own bucket.
   * Moving or versioning someone else's application is never a personal
   * folder operation, even where a share grants write access.
   */
  private async resolveOwnApplication(
    authHeaders: ReturnType<typeof getBearerAuthHeaders>,
    applicationName: string,
  ): Promise<DialApplicationResource> {
    const bucket = await this.getUserBucket(authHeaders, 'get user bucket');
    const resource = parseDialApplicationResource(applicationName) ?? {
      bucket,
      path: encodeDialResourcePath(applicationName),
    };
    assertOwnBucket(resource, bucket);
    return resource;
  }

  /*
   * The DIAL Core write already succeeded — a cache-layer hiccup must not turn
   * it into an error response, so it is logged and swallowed. The details
   * cache is keyed by application id, so every id the write touched is
   * cleared to keep a re-opened editor from loading stale configuration.
   */
  private async invalidateAfterWrite(
    userSub: string,
    applicationIds: string[],
    context: string,
  ): Promise<void> {
    try {
      await this.cacheManager.del(`applications:list:${userSub}`);
      await this.deploymentsService.invalidateListCache(userSub);
      for (const id of applicationIds) {
        await this.deploymentsDetailsService.invalidateDetailsCache(
          userSub,
          id,
        );
      }
    } catch (err) {
      handleDialFetchError(
        err,
        `invalidate caches after ${context} (sub: ${userSub})`,
        this.logger,
        0,
        { swallow: true },
      );
    }
  }

  private async readApplication(
    authHeaders: ReturnType<typeof getBearerAuthHeaders>,
    resource: DialApplicationResource,
    context: string,
  ): Promise<{ body: DialApplication; etag: string | undefined }> {
    const response = await this.dialClient.client.getCustomApplication(
      resource.bucket,
      resource.path,
      { headers: authHeaders },
    );
    if (response.error) {
      return mapDialHttpStatus(response.response.status, context, this.logger);
    }
    return {
      body: response.data as DialApplication,
      etag: response.response.headers?.get('etag') ?? undefined,
    };
  }

  private async writeApplication(
    authHeaders: ReturnType<typeof getBearerAuthHeaders>,
    resource: DialApplicationResource,
    body: DialApplication,
    context: string,
    ifMatch?: string,
  ): Promise<void> {
    const response = await this.dialClient.client.saveCustomApplication(
      resource.bucket,
      resource.path,
      {
        headers: {
          ...authHeaders,
          ...(ifMatch ? { 'If-Match': ifMatch } : {}),
        },
        body,
      },
    );
    if (!response.error) return;
    if (response.response.status === 412) {
      this.logger.warn(`DIAL Core returned 412 for ${context}`);
      throw new ConflictException(
        'The application changed while it was being saved',
      );
    }
    return mapDialHttpStatus(response.response.status, context, this.logger);
  }

  async listApplicationFolders(
    accessToken: string,
    folderPath: string,
  ): Promise<ResourceFoldersResponseDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    try {
      const bucket = await this.getUserBucket(authHeaders, 'get user bucket');
      const folders = await listDialResourceFolders(
        this.dialClient.client,
        DialResourceType.Applications,
        authHeaders,
        bucket,
        folderPath,
        this.logger,
      );
      return { folders };
    } catch (err) {
      return handleDialFetchError(
        err,
        'list application folders',
        this.logger,
        0,
      );
    }
  }

  async moveApplication(
    userSub: string,
    accessToken: string,
    applicationName: string,
    folderPath: string,
  ): Promise<ResourceIdResponseDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    const context = `move application "${applicationName}"`;
    let destination: DialApplicationResource;
    try {
      const source = await this.resolveOwnApplication(
        authHeaders,
        applicationName,
      );
      destination = {
        bucket: source.bucket,
        path: buildFolderResourcePath(folderPath, getResourceLeaf(source.path)),
      };
      if (destination.path !== source.path) {
        await this.assertNoDuplicateIdentity(
          userSub,
          accessToken,
          source.bucket,
          { folder: folderPath },
          `applications/${source.bucket}/${source.path}`,
        );
        await transferDialResource({
          client: this.dialClient.client,
          operation: 'moveResource',
          type: DialResourceType.Applications,
          headers: authHeaders,
          source,
          destination,
          context,
          logger: this.logger,
        });
      }
    } catch (err) {
      return handleDialFetchError(err, context, this.logger, 0);
    }

    const id = `applications/${destination.bucket}/${destination.path}`;
    await this.invalidateAfterWrite(userSub, [applicationName, id], context);
    return { id };
  }

  /**
   * Copies the stored application to `{folderPath}/{name}__{version}` and
   * stamps the copy with `version`. The copy is the pre-edit snapshot a
   * Quick App save-as-new-version starts from: the embedded editor then saves
   * its edits to the source and {@link commitApplicationVersion} swaps the
   * two bodies, so the edits end up in the new version only.
   */
  async forkApplicationVersion(
    userSub: string,
    accessToken: string,
    applicationName: string,
    body: ForkApplicationVersionDto,
  ): Promise<ResourceIdResponseDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    const context = `fork application "${applicationName}"`;
    let snapshot: DialApplicationResource;
    try {
      const source = await this.resolveOwnApplication(
        authHeaders,
        applicationName,
      );
      // The name itself may contain the separator; the version follows the last one.
      const leaf = getResourceLeaf(source.path);
      const separatorIndex = leaf.lastIndexOf(RESOURCE_VERSION_SEPARATOR);
      const baseName =
        separatorIndex === -1 ? leaf : leaf.slice(0, separatorIndex);
      await this.assertNoDuplicateIdentity(
        userSub,
        accessToken,
        source.bucket,
        { folder: body.folderPath, version: body.version },
        `applications/${source.bucket}/${source.path}`,
        false,
      );
      snapshot = {
        bucket: source.bucket,
        path: buildFolderResourcePath(
          body.folderPath,
          `${baseName}${RESOURCE_VERSION_SEPARATOR}${encodeURIComponent(body.version)}`,
        ),
      };
      await transferDialResource({
        client: this.dialClient.client,
        operation: 'copyResource',
        type: DialResourceType.Applications,
        headers: authHeaders,
        source,
        destination: snapshot,
        context,
        logger: this.logger,
      });

      try {
        const { body: copied, etag } = await this.readApplication(
          authHeaders,
          snapshot,
          context,
        );
        await this.writeApplication(
          authHeaders,
          snapshot,
          withDisplayVersion(copied, body.version),
          context,
          etag,
        );
      } catch (err) {
        // A copy still carrying the old version is never left behind.
        await this.dialClient.client
          .deleteCustomApplication(snapshot.bucket, snapshot.path, {
            headers: authHeaders,
          })
          .catch(() => undefined);
        throw err;
      }
    } catch (err) {
      return handleDialFetchError(err, context, this.logger, 0);
    }

    const id = `applications/${snapshot.bucket}/${snapshot.path}`;
    await this.invalidateAfterWrite(userSub, [id], context);
    return { id };
  }

  /*
   * Best-effort undo of the first commit write. If it fails too, the edits
   * are in both the source and the snapshot — duplicated, never lost.
   */
  private async rollbackSnapshot(
    authHeaders: ReturnType<typeof getBearerAuthHeaders>,
    snapshot: DialApplicationResource,
    preEditBody: DialApplication,
    context: string,
  ): Promise<void> {
    try {
      await this.writeApplication(
        authHeaders,
        snapshot,
        preEditBody,
        `${context} (rollback)`,
      );
    } catch (err) {
      handleDialFetchError(err, `${context} (rollback)`, this.logger, 0, {
        swallow: true,
      });
    }
  }

  /**
   * Swaps the bodies of the source application and its forked snapshot,
   * each keeping its own `displayVersion`: the snapshot gets the edits the
   * source was saved with, and the source gets back the pre-edit body the
   * snapshot preserved. The snapshot is written first, so the edits are
   * stored in the new version before the source is overwritten; if
   * restoring the source then fails, the snapshot is rolled back and the
   * edits stay in the source. Either way a failure never loses the edits.
   * Both writes are conditional on the ETags read here, so a concurrent
   * change answers 409.
   */
  async commitApplicationVersion(
    userSub: string,
    accessToken: string,
    applicationName: string,
    body: CommitApplicationVersionDto,
  ): Promise<ResourceIdResponseDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    const context = `commit application version "${applicationName}"`;
    try {
      const source = await this.resolveOwnApplication(
        authHeaders,
        applicationName,
      );
      const snapshot = parseDialApplicationResource(body.snapshotId);
      if (snapshot == null) {
        throw new BadRequestException(
          'snapshotId must be a full applications/{bucket}/{path} id',
        );
      }
      assertOwnBucket(snapshot, source.bucket);

      const [sourceState, snapshotState] = await Promise.all([
        this.readApplication(authHeaders, source, context),
        this.readApplication(authHeaders, snapshot, context),
      ]);
      await this.writeApplication(
        authHeaders,
        snapshot,
        withDisplayVersion(
          sourceState.body,
          getStoredDisplayVersion(snapshotState.body),
        ),
        context,
        snapshotState.etag,
      );
      try {
        await this.writeApplication(
          authHeaders,
          source,
          withDisplayVersion(
            snapshotState.body,
            getStoredDisplayVersion(sourceState.body),
          ),
          context,
          sourceState.etag,
        );
      } catch (err) {
        await this.rollbackSnapshot(
          authHeaders,
          snapshot,
          snapshotState.body,
          context,
        );
        throw err;
      }
    } catch (err) {
      return handleDialFetchError(err, context, this.logger, 0);
    }

    await this.invalidateAfterWrite(
      userSub,
      [applicationName, body.snapshotId],
      context,
    );
    return { id: body.snapshotId };
  }
}
