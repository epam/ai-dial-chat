import type { components, operations } from '@epam/ai-dial-typescript-sdk';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { AppService } from '../app/app.service';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../common/utils/uri';
import type { EnvironmentVariables } from '../config/environment.config';
import { HIDDEN_FILE } from '../constants/dial.constants';
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
type DialToolsetBody = components['schemas']['ToolSet'];
type DialToolsetSigninBody =
  operations['toolsetSignin']['requestBody']['content']['application/json'];
type DialToolsetSignoutBody =
  operations['toolSetSignout']['requestBody']['content']['application/json'];
type DialCredentialsLevel = NonNullable<
  DialToolsetSignoutBody['credentialsLevel']
>;

const toDialCredentialsLevel = (
  level: ToolsetCredentialsLevel,
): DialCredentialsLevel =>
  level === ToolsetCredentialsLevel.App ? 'APPLICATION' : level;

interface DialToolsetResource {
  bucket: string;
  path: string;
}

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

/*
 * Maps the camelCase request DTO to the snake_case body DIAL Core expects,
 * only including auth fields relevant to the selected authentication type.
 */
const toDialToolsetBody = (
  body: ToolsetBodyDto,
  version: string,
): DialToolsetBody => {
  const dialBody: DialToolsetBody = {
    displayName: body.name,
    displayVersion: version,
    endpoint: body.endpoint.trim(),
    transport: body.transport,
    allowed_tools: body.allowedTools ?? [],
    authSettings: toDialAuthSettings(body.authSettings),
  };
  if (body.description != null) dialBody.description = body.description;
  if (body.iconUrl != null) dialBody.iconUrl = body.iconUrl;
  if (body.topics != null) dialBody.descriptionKeywords = body.topics;
  if (body.reference != null) dialBody.reference = body.reference;
  if (body.intro != null) dialBody.defaults = { intro: body.intro };
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

const redactToolsetSecrets = (toolset: DialToolsetDto): DialToolsetDto => {
  const authSettingsWithSecret = toolset.auth_settings as
    | (DialToolsetAuthSettingsDto & { client_secret?: string })
    | undefined;
  if (authSettingsWithSecret?.client_secret == null) {
    return toolset;
  }
  const { client_secret: _, ...authSettings } = authSettingsWithSecret;
  return { ...toolset, auth_settings: authSettings };
};

const isVisibleToolset = (toolset: DialToolsetDto): boolean =>
  Boolean(toolset.id) && !toolset.id.includes(HIDDEN_FILE);

const isMyToolset = (toolset: DialToolsetDto, bucket: string): boolean =>
  Boolean(bucket) && toolset.id.split('/').includes(bucket);

@Injectable()
export class ToolsetsService extends AppService {
  protected override logger = new Logger(ToolsetsService.name);

  constructor(
    configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly userConfigService: UserConfigService,
  ) {
    super(configService);
  }

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
      const result = await this.client.getToolSets({
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
      const result = await this.client.getToolset(toolsetName, {
        headers: getBearerAuthHeaders(accessToken),
      });
      if (result.error) {
        return mapDialHttpStatus(
          result.response.status,
          `get toolset "${toolsetName}"`,
          this.logger,
        );
      }
      const data = redactToolsetSecrets(
        result.data as unknown as DialToolsetDto,
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
    const result = await this.client.getUserBucket({ headers: authHeaders });
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

      const response = await this.client.saveToolSet(bucket, path, {
        headers: authHeaders,
        body: toDialToolsetBody(body, version),
      });
      if (response.error) {
        return mapDialHttpStatus(
          response.response.status,
          'create toolset',
          this.logger,
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
      const response = await this.client.saveToolSet(bucket, path, {
        headers: authHeaders,
        body: toDialToolsetBody(body, version),
      });
      if (response.error) {
        return mapDialHttpStatus(
          response.response.status,
          `update toolset "${toolsetName}"`,
          this.logger,
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
      const response = await this.client.deleteToolSet(bucket, path, {
        headers: authHeaders,
      });
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
      const response = await this.client.toolsetSignin({
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
      const response = await this.client.toolSetSignout({
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
