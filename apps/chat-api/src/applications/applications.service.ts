import type { components } from '@epam/ai-dial-typescript-sdk';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import {
  composeLocalizedFields,
  toLocalizedValue,
} from '../common/utils/compose-localized-fields';
import {
  parseDialApplicationResource,
  type DialApplicationResource,
} from '../common/utils/dial-application-resource';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { DeploymentsService } from '../deployments/deployments.service';
import { DeploymentsDetailsService } from '../deployments/details/deployments-details.service';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import type { ApplicationsResponseDto } from './dto/application.dto';
import type {
  CreateApplicationBodyDto,
  CreatedApplicationDto,
} from './dto/create-application.dto';
import type {
  UpdateApplicationBodyDto,
  UpdatedApplicationDto,
} from './dto/update-application.dto';
import { hoistApplicationFields } from './utils/application-body-mapping';

type DialApplication = components['schemas']['Application'];

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly deploymentsService: DeploymentsService,
    private readonly deploymentsDetailsService: DeploymentsDetailsService,
  ) {}

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

      const version = body.version ?? '0.0.1';
      const appPath = `${body.name}__${version}`;
      const encodedPath = encodeURIComponent(appPath);

      const {
        endpoint,
        features,
        inputAttachmentTypes,
        maxInputAttachments,
        remainingProperties,
      } = hoistApplicationFields(body.applicationProperties);

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
      if (features != null)
        dialBody.features = features as (typeof dialBody)['features'];
      if (inputAttachmentTypes != null)
        dialBody.inputAttachmentTypes = inputAttachmentTypes;
      if (maxInputAttachments != null)
        dialBody.maxInputAttachments = maxInputAttachments;

      const response = await this.dialClient.client.saveCustomApplication(
        bucket,
        encodedPath,
        {
          headers: authHeaders,
          body: dialBody,
        },
      );

      if (response.error) {
        return mapDialHttpStatus(
          response.response.status,
          'create application',
          this.logger,
        );
      }

      await this.cacheManager.del(cacheKey);
      this.logger.debug(
        `Created application ${appPath}, invalidated cache for sub: ${userSub}`,
      );
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
      const mergedBody: DialApplication = {
        ...(existingResponse.data as DialApplication),
        /*
         * This is a full replacement, not a per-locale merge with whatever
         * the existing resource had — consistent with every other
         * General-step field.
         */
        displayName: toLocalizedValue(displayName),
      };
      if (description != null)
        mergedBody.description = description as unknown as string;
      if (body.iconUrl != null) mergedBody.iconUrl = body.iconUrl;
      if (body.topics != null && body.topics.length > 0) {
        mergedBody.descriptionKeywords = body.topics;
      }
      if (body.version != null) mergedBody.displayVersion = body.version;
      if (body.endpoint != null) mergedBody.endpoint = body.endpoint;
      if (body.features != null)
        mergedBody.features = body.features as (typeof mergedBody)['features'];
      if (body.inputAttachmentTypes != null)
        mergedBody.inputAttachmentTypes = body.inputAttachmentTypes;
      if (body.maxInputAttachments != null)
        mergedBody.maxInputAttachments = body.maxInputAttachments;

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
        return mapDialHttpStatus(
          saveResponse.response.status,
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
}
