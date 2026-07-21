import type { components, operations } from '@epam/ai-dial-typescript-sdk';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { getResourceDisplayNameFallback } from '../common/utils/resource-name';
import { safeDecodeURIComponent } from '../common/utils/uri';
import { HIDDEN_FILE } from '../constants/dial.constants';
import { DeploymentsService } from '../deployments/deployments.service';
import { DialClientService } from '../dial/dial-client.service';
import type {
  DialToolsetAuthSettingsDto,
  DialToolsetDto,
  DialToolsetFeaturesDto,
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

/*
 * DIAL Core returns two different wire shapes for a toolset depending on the
 * endpoint: the OpenAI-compatible toolset (getToolSets/getToolset) is
 * snake_case top-level, while the custom toolset resource
 * (getCustomToolSet/saveToolSet) is camelCase top-level except for
 * `allowed_tools`, which stays snake_case per that schema. Both put
 * snake_case fields inside their `auth_settings`/`authSettings` object
 * regardless of which top-level casing they use. This type carries both
 * possible casings through the merge/redaction pipeline before
 * `mapDialToolsetToDto` normalizes everything to the outgoing camelCase
 * `DialToolsetDto` shape exactly once.
 */
interface RawDialToolset {
  id: string;
  toolset: string;
  display_name?: string;
  displayName?: string;
  display_version?: string;
  displayVersion?: string;
  description?: string;
  intro?: string;
  icon_url?: string;
  iconUrl?: string;
  owner?: string;
  object?: string;
  status?: string;
  description_keywords?: string[];
  descriptionKeywords?: string[];
  reference?: string;
  max_retry_attempts?: number;
  maxRetryAttempts?: number;
  created_at?: number;
  createdAt?: number;
  updated_at?: number;
  updatedAt?: number;
  features?: unknown;
  endpoint?: string;
  transport?: string;
  allowed_tools?: string[];
  allowedTools?: string[];
  auth_settings?: RawAuthSettings;
  authSettings?: RawAuthSettings;
}

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

/*
 * Unlike the path-based endpoints (get/update/delete), DIAL Core's signin
 * body `url` field is never implicitly percent-decoded by an HTTP routing
 * layer before DIAL Core encodes it internally to match its stored resource
 * key — so an already percent-encoded value here ends up encoded twice on
 * DIAL Core's side. Sending the raw (decoded) resource reference instead
 * lets DIAL Core apply that one encoding step itself, matching the same
 * single-encoded key path-based lookups arrive at.
 */
const resolveToolsetLoginUrl = (toolsetName: string): string => {
  const resource = parseDialToolsetResource(toolsetName);
  if (!resource) {
    throw new BadRequestException('Toolset id must include bucket and path');
  }
  return `${TOOLSET_RESOURCE_PREFIX}${resource.bucket}/${safeDecodeURIComponent(resource.path)}`;
};

const toDialToolsetSigninBody = (
  body: ToolsetLoginBodyDto,
  toolsetName: string,
): DialToolsetSigninBody => {
  const base = {
    url: resolveToolsetLoginUrl(toolsetName),
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
  authenticationType: string | undefined,
  toolsetName: string,
): DialToolsetSignoutBody => {
  if (
    authenticationType !== ToolsetAuthType.ApiKey &&
    authenticationType !== ToolsetAuthType.OAuth
  ) {
    throw new BadRequestException('Unsupported toolset authentication type');
  }

  return {
    url: resolveToolsetLoginUrl(toolsetName),
    credentialsLevel: toDialCredentialsLevel(body.credentialsLevel),
    authenticationType,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const getString = (
  record: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
};

const getBoolean = (
  record: Record<string, unknown>,
  key: string,
): boolean | undefined => {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
};

const getStringArray = (
  record: Record<string, unknown>,
  key: string,
): string[] | undefined => {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
};

const isVisibleToolset = (toolset: RawDialToolset): boolean =>
  Boolean(toolset.id) && !toolset.id.includes(HIDDEN_FILE);

const isMyToolset = (toolset: DialToolsetDto, bucket: string): boolean =>
  Boolean(bucket) && toolset.id.split('/').includes(bucket);

/*
 * Resolves whichever raw auth settings container the source endpoint used
 * (`authSettings` for the custom toolset resource, `auth_settings` for the
 * OpenAI-compatible toolset) without yet converting its nested fields —
 * used by the pre-mapping merge step, which needs to combine partial raw
 * dicts from two sources before the single final camelCase conversion.
 */
const getRawAuthSettings = (
  toolset?: RawDialToolset,
): RawAuthSettings | undefined => {
  const settings = toolset?.authSettings ?? toolset?.auth_settings;
  return isRecord(settings) ? settings : undefined;
};

/*
 * Never reads client_secret/code_verifier — the allowlist of fields copied
 * here doubles as the secret redaction, so a raw payload carrying those
 * fields (as sent to DIAL Core) never reaches the response.
 */
const mapAuthSettings = (
  raw?: RawAuthSettings,
): DialToolsetAuthSettingsDto | undefined => {
  if (!isRecord(raw)) return undefined;
  const authenticationType = getString(raw, 'authentication_type');
  if (authenticationType == null) return undefined;

  return {
    authenticationType,
    apiKeyHeader: getString(raw, 'api_key_header'),
    clientId: getString(raw, 'client_id'),
    redirectUri: getString(raw, 'redirect_uri'),
    authorizationEndpoint: getString(raw, 'authorization_endpoint'),
    tokenEndpoint: getString(raw, 'token_endpoint'),
    codeChallenge: getString(raw, 'code_challenge'),
    codeChallengeMethod: getString(raw, 'code_challenge_method'),
    scopesSupported: getStringArray(raw, 'scopes_supported'),
    globalAuthStatus: getString(raw, 'global_auth_status'),
    userLevelAuthStatus: getString(raw, 'user_level_auth_status'),
  };
};

const mapToolsetFeatures = (
  raw: unknown,
): DialToolsetFeaturesDto | undefined => {
  if (!isRecord(raw)) return undefined;

  return {
    rate: getBoolean(raw, 'rate'),
    tokenize: getBoolean(raw, 'tokenize'),
    truncatePrompt: getBoolean(raw, 'truncate_prompt'),
    configuration: getBoolean(raw, 'configuration'),
    systemPrompt: getBoolean(raw, 'system_prompt'),
    tools: getBoolean(raw, 'tools'),
    seed: getBoolean(raw, 'seed'),
    urlAttachments: getBoolean(raw, 'url_attachments'),
    folderAttachments: getBoolean(raw, 'folder_attachments'),
    allowResume: getBoolean(raw, 'allow_resume'),
    accessibleByPerRequestKey: getBoolean(raw, 'accessible_by_per_request_key'),
    contentParts: getBoolean(raw, 'content_parts'),
    temperature: getBoolean(raw, 'temperature'),
    cache: getBoolean(raw, 'cache'),
    autoCaching: getBoolean(raw, 'auto_caching'),
    parallelToolCalls: getBoolean(raw, 'parallel_tool_calls'),
    assistantAttachmentsInRequest: getBoolean(
      raw,
      'assistant_attachments_in_request',
    ),
    mcp: getBoolean(raw, 'mcp'),
    chatCompletion: getBoolean(raw, 'chat_completion'),
    responsesApi: getBoolean(raw, 'responses_api'),
    maxTokensSupported: getBoolean(raw, 'max_tokens_supported'),
    maxCompletionTokensSupported: getBoolean(
      raw,
      'max_completion_tokens_supported',
    ),
    customTemperatureSupported: getBoolean(raw, 'custom_temperature_supported'),
    reasoningEfforts: getStringArray(raw, 'reasoning_efforts'),
  };
};

/*
 * Single point where every raw DIAL Core toolset field (whichever casing
 * the source endpoint used) is converted into the outgoing camelCase
 * `DialToolsetDto` shape, mirroring `deployments.service.ts`'s
 * `mapToDeploymentItem`. Applied exactly once, after any raw-level merging
 * (`mergeCustomToolsetDetails`) is done.
 */
const mapDialToolsetToDto = (raw: RawDialToolset): DialToolsetDto => ({
  id: raw.id,
  toolset: raw.toolset,
  displayName:
    raw.displayName ??
    raw.display_name ??
    getResourceDisplayNameFallback(raw.id),
  displayVersion: raw.displayVersion ?? raw.display_version,
  description: raw.description,
  intro: raw.intro,
  iconUrl: raw.iconUrl ?? raw.icon_url,
  owner: raw.owner,
  object: raw.object,
  status: raw.status,
  descriptionKeywords: raw.descriptionKeywords ?? raw.description_keywords,
  reference: raw.reference,
  maxRetryAttempts: raw.maxRetryAttempts ?? raw.max_retry_attempts,
  createdAt: raw.createdAt ?? raw.created_at,
  updatedAt: raw.updatedAt ?? raw.updated_at,
  features: mapToolsetFeatures(raw.features),
  endpoint: raw.endpoint,
  transport: raw.transport,
  allowedTools: raw.allowedTools ?? raw.allowed_tools,
  authSettings: mapAuthSettings(getRawAuthSettings(raw)),
});

const mergeCustomToolsetDetails = (
  customToolset: RawDialToolset,
  toolsetName: string,
  extendedToolset?: RawDialToolset,
): RawDialToolset => {
  const mergedAuthSettings = {
    ...(getRawAuthSettings(extendedToolset) ?? {}),
    ...(getRawAuthSettings(customToolset) ?? {}),
  };
  const mergedToolset: RawDialToolset = {
    ...(extendedToolset ?? {}),
    ...customToolset,
    id: customToolset.id ?? extendedToolset?.id ?? toolsetName,
    toolset: customToolset.toolset ?? extendedToolset?.toolset ?? toolsetName,
    object: customToolset.object ?? extendedToolset?.object ?? 'toolset',
  };

  delete mergedToolset.authSettings;
  delete mergedToolset.auth_settings;

  if (Object.keys(mergedAuthSettings).length > 0) {
    mergedToolset.auth_settings = mergedAuthSettings;
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
    private readonly deploymentsService: DeploymentsService,
  ) {}

  private enrichToolsetWithOwnership(
    toolset: DialToolsetDto,
    installedIdSet: Set<string>,
    bucket: string,
    writableUrls: Set<string>,
    sharedUrls: Set<string>,
  ): DialToolsetDto {
    const isMy = isMyToolset(toolset, bucket);
    return {
      ...toolset,
      isInstalled: installedIdSet.has(toolset.id),
      isMy,
      canEdit: isMy || writableUrls.has(toolset.id),
      sharedWithMe: !isMy && sharedUrls.has(toolset.id),
    };
  }

  /**
   * Resolves every toolset resource shared with the current user (READ or
   * WRITE), in a single upstream call reused to derive both the WRITE-only
   * "can edit" set and the unfiltered "shared with me" set — avoids issuing
   * `getSharedResources` twice per list/get request. Best-effort: a DIAL
   * Core error here degrades to "no shared toolsets" rather than failing the
   * whole request.
   */
  private async getSharedToolsetResources(
    accessToken: string,
  ): Promise<{ url?: string; permissions?: string[] }[]> {
    try {
      const { data, error, response } =
        await this.dialClient.client.getSharedResources({
          headers: getBearerAuthHeaders(accessToken),
          body: { resourceTypes: ['TOOL_SET'], with: 'me' },
        });
      if (error) {
        this.logger.warn(
          `Failed to resolve shared toolset resources: status=${response.status}`,
        );
        return [];
      }

      return (data?.resources ?? []) as {
        url?: string;
        permissions?: string[];
      }[];
    } catch (err) {
      this.logger.warn('Failed to resolve shared toolset resources', err);
      return [];
    }
  }

  private toWritableAndSharedUrls(
    resources: { url?: string; permissions?: string[] }[],
  ): { writableUrls: Set<string>; sharedUrls: Set<string> } {
    const writableUrls = new Set(
      resources
        .filter((resource) => resource.permissions?.includes('WRITE'))
        .map((resource) => resource.url)
        .filter((url): url is string => url != null),
    );
    const sharedUrls = new Set(
      resources
        .map((resource) => resource.url)
        .filter((url): url is string => url != null),
    );
    return { writableUrls, sharedUrls };
  }

  private async enrichToolsetsOwnership(
    toolsets: DialToolsetDto[],
    accessToken: string,
    bucket: string,
  ): Promise<DialToolsetDto[]> {
    const [{ toolsets: installedIds }, sharedResources] = await Promise.all([
      this.userConfigService.getInstalledIds(accessToken, bucket),
      this.getSharedToolsetResources(accessToken),
    ]);
    const installedSet = new Set(installedIds);
    const { writableUrls, sharedUrls } =
      this.toWritableAndSharedUrls(sharedResources);
    return toolsets.map((toolset) =>
      this.enrichToolsetWithOwnership(
        toolset,
        installedSet,
        bucket,
        writableUrls,
        sharedUrls,
      ),
    );
  }

  private async getOpenAiToolset(
    accessToken: string,
    toolsetName: string,
  ): Promise<RawDialToolset> {
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
    return result.data as unknown as RawDialToolset;
  }

  private async tryGetOpenAiToolset(
    accessToken: string,
    toolsetName: string,
  ): Promise<RawDialToolset | undefined> {
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
  ): Promise<RawDialToolset> {
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
      result.data as unknown as RawDialToolset,
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

    return getRawAuthSettings(result.data as unknown as RawDialToolset);
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
      const { data: toolsets } = result.data as unknown as {
        data: RawDialToolset[];
      };
      const data: DialToolsetListResponseDto = {
        data: (toolsets ?? [])
          .filter(isVisibleToolset)
          .map(mapDialToolsetToDto),
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
      const [{ toolsets: installedIds }, sharedResources] = await Promise.all([
        this.userConfigService.getInstalledIds(accessToken, bucket),
        this.getSharedToolsetResources(accessToken),
      ]);
      const { writableUrls, sharedUrls } =
        this.toWritableAndSharedUrls(sharedResources);
      return this.enrichToolsetWithOwnership(
        toolset,
        new Set(installedIds),
        bucket,
        writableUrls,
        sharedUrls,
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
      const rawToolset =
        resource == null
          ? await this.getOpenAiToolset(accessToken, toolsetName)
          : await this.getCustomToolset(accessToken, toolsetName, resource);
      const data = mapDialToolsetToDto(rawToolset);
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

  /**
   * Resolves a single toolset by id for contexts that don't already have the
   * caller's bucket at hand — e.g. right after accepting a share invitation,
   * where waiting for the bulk toolsets list to reflect a just-granted share
   * is an unbounded race against DIAL Core's own propagation. Reuses
   * `getToolset`'s existing resource resolution/ownership-enrichment; only
   * resolves the caller's own bucket first, which `getToolset` needs for the
   * `isMy`/`canEdit` ownership fields.
   *
   * Returns `null` (not a thrown exception) when DIAL Core has no match for
   * this id — only a genuine upstream error (5xx, network, timeout)
   * propagates as an exception.
   */
  async resolveToolsetItem(
    userSub: string,
    accessToken: string,
    toolsetName: string,
  ): Promise<DialToolsetDto | null> {
    try {
      const bucket = await this.getUserBucket(
        getBearerAuthHeaders(accessToken),
        `resolve toolset item "${toolsetName}"`,
      );
      return await this.getToolset(userSub, accessToken, bucket, toolsetName);
    } catch (err) {
      if (err instanceof NotFoundException) return null;
      throw err;
    }
  }

  private async invalidateCaches(
    userSub: string,
    toolsetName?: string,
  ): Promise<void> {
    await this.cacheManager.del(`toolsets:list:${userSub}`);
    if (toolsetName != null) {
      await this.cacheManager.del(`toolsets:single:${userSub}:${toolsetName}`);
      /*
       * The details panel reads toolset auth status through
       * `DeploymentsService.getDeploymentDetails`, which caches independently
       * of the toolsets caches above — without this, a login/logout leaves
       * that panel showing the pre-change credential status for up to 60s.
       */
      await this.deploymentsService.invalidateDetailsCache(
        userSub,
        toolsetName,
      );
    }
  }

  /**
   * Evicts the cached toolsets list for a user so the next `listToolsets`
   * call re-fetches from DIAL Core instead of serving a stale snapshot —
   * e.g. right after the user accepted a share invitation granting access to
   * a new toolset.
   */
  async invalidateListCache(userSub: string): Promise<void> {
    await this.invalidateCaches(userSub);
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
          response.error,
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
          response.error,
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
      (await this.getToolset(userSub, accessToken, bucket, toolsetName))
        .authSettings?.authenticationType;
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
