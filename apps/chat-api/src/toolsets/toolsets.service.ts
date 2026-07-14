import type { components, operations } from '@epam/ai-dial-typescript-sdk';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  BadRequestException,
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
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../common/utils/uri';
import { HIDDEN_FILE } from '../constants/dial.constants';
import { DialClientService } from '../dial/dial-client.service';
import type {
  DialToolsetAuthSettingsDto,
  DialToolsetDto,
  DialToolsetListResponseDto,
} from '../openapi/openapi-response.dto';
import { UserConfigService } from '../user-config/user-config.service';
import {
  ToolsetCredentialsLevel,
  type ToolsetLoginBodyDto,
  type ToolsetLogoutBodyDto,
} from './dto/toolset-auth.dto';
import { ToolsetAuthType } from './dto/toolset-body.dto';
import type { MutatedToolsetDto, ToolsetBodyDto } from './dto/toolset-body.dto';

const DEFAULT_TOOLSET_VERSION = '0.0.1';
const TOOLSET_RESOURCE_PREFIX = 'toolsets/';

type DialAuthSettings = components['schemas']['ResourceAuthSettings'];
type DialToolsetSigninBody =
  operations['toolsetSignin']['requestBody']['content']['application/json'];
type DialToolsetSignoutBody =
  operations['toolSetSignout']['requestBody']['content']['application/json'];
type DialCredentialsLevel = NonNullable<
  DialToolsetSignoutBody['credentialsLevel']
>;
type RawAuthSettings = Record<string, unknown>;

const toDialCredentialsLevel = (
  level: ToolsetCredentialsLevel,
): DialCredentialsLevel =>
  level === ToolsetCredentialsLevel.App ? 'APPLICATION' : level;

/*
 * saveToolSet's non-2xx responses aren't part of its documented response
 * schema, so the SDK surfaces the raw DIAL Core error body untyped — it may
 * be a plain string (e.g. an endpoint-reachability failure) or an object
 * carrying a `message` field.
 */
const extractDialErrorMessage = (error: unknown): string | undefined => {
  if (typeof error === 'string') return error;
  if (error != null && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return undefined;
};

interface DialToolsetResource {
  bucket: string;
  path: string;
}

type RawDialToolsetDto = DialToolsetDto & {
  authSettings?: RawAuthSettings;
};

type DialToolsetSaveBody = {
  displayName: string;
  displayVersion: string;
  endpoint: string;
  transport: ToolsetBodyDto['transport'];
  allowed_tools: string[];
  authSettings: DialAuthSettings;
  description?: string;
  iconUrl?: string;
  descriptionKeywords?: string[];
  reference?: string;
  intro?: string;
};

/*
 * OAuth fields that must survive a save which doesn't resubmit them — e.g.
 * the "With Login" mode only sends { authentication_type, redirect_uri } to
 * reuse an already-configured client and reauthenticate, so every other
 * OAuth field has to be carried over from the stored config or DIAL Core
 * would receive (and likely reject) a wiped-out registration.
 */
const OAUTH_MERGEABLE_KEYS = [
  'client_id',
  'client_secret',
  'authorization_endpoint',
  'token_endpoint',
  'scopes_supported',
  'code_challenge',
  'code_challenge_method',
] as const;

const parseDialToolsetResource = (
  toolsetName: string,
): DialToolsetResource | undefined => {
  if (!toolsetName.startsWith(TOOLSET_RESOURCE_PREFIX)) {
    return undefined;
  }

  const resource = toolsetName.slice(TOOLSET_RESOURCE_PREFIX.length);
  const [bucket, ...pathSegments] = resource.split('/');
  const path = pathSegments.join('/');
  if (!bucket || !path) {
    throw new BadRequestException('Toolset id must include bucket and path');
  }

  return { bucket, path: encodeDialResourcePath(path) };
};

const toDialAuthSettings = (
  auth: ToolsetBodyDto['authSettings'],
): DialAuthSettings => {
  if (auth.authenticationType === ToolsetAuthType.ApiKey) {
    return {
      authentication_type: auth.authenticationType,
      ...(auth.apiKeyHeader != null
        ? { api_key_header: auth.apiKeyHeader }
        : {}),
    };
  }

  if (auth.authenticationType === ToolsetAuthType.OAuth) {
    return {
      authentication_type: auth.authenticationType,
      ...(auth.clientId != null ? { client_id: auth.clientId } : {}),
      ...(auth.clientSecret != null
        ? { client_secret: auth.clientSecret }
        : {}),
      ...(auth.authorizationEndpoint != null
        ? { authorization_endpoint: auth.authorizationEndpoint }
        : {}),
      ...(auth.tokenEndpoint != null
        ? { token_endpoint: auth.tokenEndpoint }
        : {}),
      ...(auth.scopesSupported != null
        ? { scopes_supported: auth.scopesSupported }
        : {}),
      ...(auth.redirectUri != null ? { redirect_uri: auth.redirectUri } : {}),
      ...(auth.codeChallenge != null
        ? { code_challenge: auth.codeChallenge }
        : {}),
      ...(auth.codeChallengeMethod != null
        ? { code_challenge_method: auth.codeChallengeMethod }
        : {}),
    };
  }

  return { authentication_type: auth.authenticationType };
};

const preserveHiddenAuthSettings = (
  authSettings: DialAuthSettings,
  existingAuthSettings?: RawAuthSettings,
): DialAuthSettings => {
  const mergedAuthSettings: RawAuthSettings = { ...authSettings };

  if (
    existingAuthSettings != null &&
    authSettings.authentication_type === ToolsetAuthType.OAuth &&
    authSettings.authentication_type ===
      existingAuthSettings.authentication_type
  ) {
    for (const key of OAUTH_MERGEABLE_KEYS) {
      if (
        mergedAuthSettings[key] == null &&
        existingAuthSettings[key] != null
      ) {
        mergedAuthSettings[key] = existingAuthSettings[key];
      }
    }
  }

  return mergedAuthSettings as DialAuthSettings;
};

/*
 * Maps the request DTO to the body DIAL Core's ToolSet schema expects:
 * camelCase top-level fields (allowed_tools stays snake_case per that
 * schema), with authSettings itself holding snake_case fields, only
 * including auth fields relevant to the selected authentication type.
 */
const toDialToolsetBody = (
  body: ToolsetBodyDto,
  version: string,
  existingAuthSettings?: RawAuthSettings,
): DialToolsetSaveBody => {
  const authSettings = preserveHiddenAuthSettings(
    toDialAuthSettings(body.authSettings),
    existingAuthSettings,
  );
  const dialBody: DialToolsetSaveBody = {
    displayName: body.name,
    displayVersion: version,
    endpoint: body.endpoint.trim(),
    transport: body.transport,
    allowed_tools: body.allowedTools ?? [],
    authSettings,
  };
  if (body.description != null) dialBody.description = body.description;
  if (body.iconUrl != null) dialBody.iconUrl = body.iconUrl;
  if (body.topics != null) dialBody.descriptionKeywords = body.topics;
  if (body.reference != null) dialBody.reference = body.reference;
  if (body.intro != null) dialBody.intro = body.intro;
  return dialBody;
};

const toDialToolsetSigninBody = (
  body: ToolsetLoginBodyDto,
): DialToolsetSigninBody => {
  const base = {
    url: body.url,
    credentialsLevel: toDialCredentialsLevel(body.credentialsLevel),
  };

  if (body.authenticationType === ToolsetAuthType.ApiKey) {
    return {
      ...base,
      authenticationType: ToolsetAuthType.ApiKey,
      apiKey: body.apiKey,
    };
  }

  if (body.authenticationType === ToolsetAuthType.OAuth) {
    return {
      ...base,
      authenticationType: ToolsetAuthType.OAuth,
      code: body.code,
      redirectUri: body.redirectUri,
    };
  }

  throw new BadRequestException('Unsupported toolset authentication type');
};

const toDialToolsetSignoutBody = (
  body: ToolsetLogoutBodyDto,
): DialToolsetSignoutBody => {
  if (
    body.authenticationType !== ToolsetAuthType.ApiKey &&
    body.authenticationType !== ToolsetAuthType.OAuth
  ) {
    throw new BadRequestException('Unsupported toolset authentication type');
  }

  return {
    url: body.url,
    credentialsLevel: toDialCredentialsLevel(body.credentialsLevel),
    authenticationType: body.authenticationType,
  };
};

const redactAuthSettingsSecrets = <
  TAuthSettings extends Record<string, unknown>,
>(
  authSettings?: TAuthSettings,
): TAuthSettings | undefined => {
  if (authSettings == null) {
    return undefined;
  }

  const redacted = { ...authSettings };
  delete redacted.client_secret;
  delete redacted.clientSecret;
  delete redacted.code_verifier;
  delete redacted.codeVerifier;
  return redacted as TAuthSettings;
};

const redactToolsetSecrets = (toolset: DialToolsetDto): DialToolsetDto => {
  const rawToolset = toolset as RawDialToolsetDto;
  const authSettings = redactAuthSettingsSecrets(
    rawToolset.auth_settings as Record<string, unknown> | undefined,
  );
  const camelAuthSettings = redactAuthSettingsSecrets(rawToolset.authSettings);

  return {
    ...rawToolset,
    ...(authSettings != null
      ? {
          auth_settings: authSettings as unknown as DialToolsetAuthSettingsDto,
        }
      : {}),
    ...(camelAuthSettings != null ? { authSettings: camelAuthSettings } : {}),
  };
};

const isVisibleToolset = (toolset: DialToolsetDto): boolean =>
  Boolean(toolset.id) && !toolset.id.includes(HIDDEN_FILE);

const isMyToolset = (toolset: DialToolsetDto, bucket: string): boolean =>
  Boolean(bucket) && toolset.id.split('/').includes(bucket);

const getAuthSettings = (
  toolset?: DialToolsetDto,
): RawAuthSettings | undefined => {
  const rawToolset = toolset as RawDialToolsetDto | undefined;
  return (
    rawToolset?.authSettings ??
    (rawToolset?.auth_settings as unknown as RawAuthSettings | undefined)
  );
};

const mergeCustomToolsetDetails = (
  customToolset: DialToolsetDto,
  toolsetName: string,
  extendedToolset?: DialToolsetDto,
): DialToolsetDto => {
  const mergedAuthSettings = {
    ...(getAuthSettings(extendedToolset) ?? {}),
    ...(getAuthSettings(customToolset) ?? {}),
  };
  const mergedToolset: RawDialToolsetDto = {
    ...(extendedToolset ?? {}),
    ...customToolset,
    id: customToolset.id ?? extendedToolset?.id ?? toolsetName,
    toolset: customToolset.toolset ?? extendedToolset?.toolset ?? toolsetName,
    object: customToolset.object ?? extendedToolset?.object ?? 'toolset',
  };

  delete mergedToolset.authSettings;

  if (Object.keys(mergedAuthSettings).length > 0) {
    mergedToolset.auth_settings =
      mergedAuthSettings as unknown as DialToolsetAuthSettingsDto;
  }

  return mergedToolset;
};

@Injectable()
export class ToolsetsService {
  private readonly logger = new Logger(ToolsetsService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly userConfigService: UserConfigService,
  ) {}

  private enrichToolsetWithOwnership(
    toolset: DialToolsetDto,
    installedIdSet: Set<string>,
    bucket: string,
  ): DialToolsetDto {
    return {
      ...toolset,
      is_installed: installedIdSet.has(toolset.id),
      is_my: isMyToolset(toolset, bucket),
    };
  }

  private async enrichToolsetsOwnership(
    toolsets: DialToolsetDto[],
    accessToken: string,
    bucket: string,
  ): Promise<DialToolsetDto[]> {
    const { toolsets: installedIds } =
      await this.userConfigService.getInstalledIds(accessToken, bucket);
    const installedSet = new Set(installedIds);
    return toolsets.map((toolset) =>
      this.enrichToolsetWithOwnership(toolset, installedSet, bucket),
    );
  }

  private async getOpenAiToolset(
    accessToken: string,
    toolsetName: string,
  ): Promise<DialToolsetDto> {
    const result = await this.dialClient.client.getToolset(toolsetName, {
      headers: getBearerAuthHeaders(accessToken),
    });
    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        `get toolset "${toolsetName}"`,
        this.logger,
      );
    }
    return result.data as unknown as DialToolsetDto;
  }

  private async tryGetOpenAiToolset(
    accessToken: string,
    toolsetName: string,
  ): Promise<DialToolsetDto | undefined> {
    try {
      return await this.getOpenAiToolset(accessToken, toolsetName);
    } catch (err) {
      this.logger.debug(
        `Skipped extended toolset details for "${toolsetName}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  private async getCustomToolset(
    accessToken: string,
    toolsetName: string,
    resource: DialToolsetResource,
  ): Promise<DialToolsetDto> {
    const result = await this.dialClient.client.getCustomToolSet(
      resource.bucket,
      resource.path,
      {
        headers: getBearerAuthHeaders(accessToken),
      },
    );
    if (result.error) {
      if (result.response.status === 404) {
        return this.getOpenAiToolset(accessToken, toolsetName);
      }
      return mapDialHttpStatus(
        result.response.status,
        `get custom toolset "${toolsetName}"`,
        this.logger,
      );
    }

    const extendedToolset = await this.tryGetOpenAiToolset(
      accessToken,
      toolsetName,
    );

    return mergeCustomToolsetDetails(
      result.data as unknown as DialToolsetDto,
      toolsetName,
      extendedToolset,
    );
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

    return getAuthSettings(result.data as unknown as DialToolsetDto);
  }

  async listToolsets(
    userSub: string,
    accessToken: string,
    bucket: string,
  ): Promise<DialToolsetListResponseDto> {
    const cacheKey = `toolsets:list:${userSub}`;
    const cached =
      await this.cacheManager.get<DialToolsetListResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for toolsets list (sub: ${userSub})`);
      return {
        data: await this.enrichToolsetsOwnership(
          cached.data,
          accessToken,
          bucket,
        ),
      };
    }

    try {
      const result = await this.dialClient.client.getToolSets({
        headers: getBearerAuthHeaders(accessToken),
      });
      if (result.error) {
        return mapDialHttpStatus(
          result.response.status,
          'list toolsets',
          this.logger,
        );
      }
      const { data: toolsets } =
        result.data as unknown as DialToolsetListResponseDto;
      const data: DialToolsetListResponseDto = {
        data: (toolsets ?? [])
          .filter(isVisibleToolset)
          .map(redactToolsetSecrets),
      };
      await this.cacheManager.set(cacheKey, data, 30 * 1000);
      return {
        data: await this.enrichToolsetsOwnership(
          data.data,
          accessToken,
          bucket,
        ),
      };
    } catch (err) {
      return handleDialFetchError(err, 'list toolsets', this.logger, 0);
    }
  }

  async getToolset(
    userSub: string,
    accessToken: string,
    bucket: string,
    toolsetName: string,
  ): Promise<DialToolsetDto> {
    const cacheKey = `toolsets:single:${userSub}:${toolsetName}`;

    const enrich = async (toolset: DialToolsetDto): Promise<DialToolsetDto> => {
      const { toolsets: installedIds } =
        await this.userConfigService.getInstalledIds(accessToken, bucket);
      return this.enrichToolsetWithOwnership(
        toolset,
        new Set(installedIds),
        bucket,
      );
    };

    const cached = await this.cacheManager.get<DialToolsetDto>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Cache hit for toolset "${toolsetName}" (sub: ${userSub})`,
      );
      return enrich(cached);
    }

    try {
      const resource = parseDialToolsetResource(toolsetName);
      const data = redactToolsetSecrets(
        resource == null
          ? await this.getOpenAiToolset(accessToken, toolsetName)
          : await this.getCustomToolset(accessToken, toolsetName, resource),
      );
      await this.cacheManager.set(cacheKey, data, 60 * 1000);
      return enrich(data);
    } catch (err) {
      return handleDialFetchError(
        err,
        `get toolset "${toolsetName}"`,
        this.logger,
        0,
      );
    }
  }

  private async invalidateCaches(
    userSub: string,
    toolsetName?: string,
  ): Promise<void> {
    await this.cacheManager.del(`toolsets:list:${userSub}`);
    if (toolsetName != null) {
      await this.cacheManager.del(`toolsets:single:${userSub}:${toolsetName}`);
    }
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

  private async resolveToolsetResource(
    authHeaders: ReturnType<typeof getBearerAuthHeaders>,
    toolsetName: string,
  ): Promise<DialToolsetResource> {
    const resource = parseDialToolsetResource(toolsetName);
    if (resource != null) {
      return resource;
    }

    return {
      bucket: await this.getUserBucket(authHeaders, 'get user bucket'),
      path: encodeDialResourcePath(toolsetName),
    };
  }

  async createToolset(
    userSub: string,
    accessToken: string,
    body: ToolsetBodyDto,
  ): Promise<MutatedToolsetDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);

    try {
      const bucket = await this.getUserBucket(authHeaders, 'get user bucket');
      const version = body.version ?? DEFAULT_TOOLSET_VERSION;
      const path = encodeURIComponent(
        safeDecodeURIComponent(`${body.name}__${version}`),
      );
      const id = `${TOOLSET_RESOURCE_PREFIX}${bucket}/${path}`;

      const response = await this.dialClient.client.saveToolSet(bucket, path, {
        headers: authHeaders,
        body: toDialToolsetBody(body, version),
      });
      if (response.error) {
        this.logger.warn(
          `DIAL Core rejected create toolset: ${JSON.stringify(response.error)}`,
        );
        return mapDialHttpStatus(
          response.response.status,
          'create toolset',
          this.logger,
          extractDialErrorMessage(response.error),
        );
      }
      await this.invalidateCaches(userSub);
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
      const { bucket, path } = await this.resolveToolsetResource(
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
        body: toDialToolsetBody(body, version, existingAuthSettings),
      });
      if (response.error) {
        this.logger.warn(
          `DIAL Core rejected update toolset "${toolsetName}": ${JSON.stringify(response.error)}`,
        );
        return mapDialHttpStatus(
          response.response.status,
          `update toolset "${toolsetName}"`,
          this.logger,
          extractDialErrorMessage(response.error),
        );
      }
      await this.invalidateCaches(userSub, toolsetName);
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
      const { bucket, path } = await this.resolveToolsetResource(
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
      await this.invalidateCaches(userSub, toolsetName);
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

  async loginToolset(
    userSub: string,
    accessToken: string,
    toolsetName: string,
    body: ToolsetLoginBodyDto,
  ): Promise<void> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    // NOTE: never log apiKey / code — only the toolset reference and level.
    const dialBody = toDialToolsetSigninBody(body);

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
        );
      }
      await this.invalidateCaches(userSub, toolsetName);
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
    toolsetName: string,
    body: ToolsetLogoutBodyDto,
  ): Promise<void> {
    const authHeaders = getBearerAuthHeaders(accessToken);

    try {
      const response = await this.dialClient.client.toolSetSignout({
        headers: authHeaders,
        body: toDialToolsetSignoutBody(body),
      });
      if (response.error) {
        return mapDialHttpStatus(
          response.response.status,
          `log out toolset "${toolsetName}"`,
          this.logger,
        );
      }
      await this.invalidateCaches(userSub, toolsetName);
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
