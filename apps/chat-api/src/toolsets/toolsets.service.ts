import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/utils/dial-fetch-error';
import type { EnvironmentVariables } from '../config/environment.config';
import type {
  DialToolsetAuthSettingsDto,
  DialToolsetDto,
  DialToolsetListResponseDto,
} from '../openapi/openapi-response.dto';
import type {
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from './dto/toolset-auth.dto';
import { ToolsetAuthType } from './dto/toolset-body.dto';
import type { MutatedToolsetDto, ToolsetBodyDto } from './dto/toolset-body.dto';

const DEFAULT_TOOLSET_VERSION = '0.0.1';

// Maps the camelCase request DTO to the snake_case body DIAL Core expects,
// only including auth fields relevant to the selected authentication type.
const toDialToolsetBody = (
  body: ToolsetBodyDto,
  version: string,
): Record<string, unknown> => {
  const auth = body.authSettings;
  const authSettings: Record<string, unknown> = {
    authentication_type: auth.authenticationType,
  };
  if (auth.authenticationType === ToolsetAuthType.ApiKey) {
    if (auth.apiKeyHeader != null)
      authSettings.api_key_header = auth.apiKeyHeader;
  } else if (auth.authenticationType === ToolsetAuthType.OAuth) {
    if (auth.clientId != null) authSettings.client_id = auth.clientId;
    if (auth.clientSecret != null)
      authSettings.client_secret = auth.clientSecret;
    if (auth.authorizationEndpoint != null)
      authSettings.authorization_endpoint = auth.authorizationEndpoint;
    if (auth.tokenEndpoint != null)
      authSettings.token_endpoint = auth.tokenEndpoint;
    if (auth.scopesSupported != null)
      authSettings.scopes_supported = auth.scopesSupported;
    if (auth.redirectUri != null) authSettings.redirect_uri = auth.redirectUri;
    if (auth.codeChallenge != null)
      authSettings.code_challenge = auth.codeChallenge;
    if (auth.codeChallengeMethod != null)
      authSettings.code_challenge_method = auth.codeChallengeMethod;
  }

  const dialBody: Record<string, unknown> = {
    display_name: body.name,
    display_version: version,
    endpoint: body.endpoint.trim(),
    transport: body.transport,
    allowed_tools: body.allowedTools ?? [],
    auth_settings: authSettings,
  };
  if (body.description != null) dialBody.description = body.description;
  if (body.iconUrl != null) dialBody.icon_url = body.iconUrl;
  if (body.topics != null) dialBody.description_keywords = body.topics;
  if (body.reference != null) dialBody.reference = body.reference;
  return dialBody;
};

const redactToolsetSecrets = (toolset: DialToolsetDto): DialToolsetDto => {
  if (toolset.auth_settings?.client_secret == null) {
    return toolset;
  }
  const { client_secret: _, ...authSettings } =
    toolset.auth_settings as DialToolsetAuthSettingsDto & {
      client_secret?: string;
    };
  return { ...toolset, auth_settings: authSettings };
};

@Injectable()
export class ToolsetsService extends AppService {
  protected override logger = new Logger(ToolsetsService.name);

  constructor(
    configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    super(configService);
  }

  async listToolsets(
    userSub: string,
    accessToken: string,
  ): Promise<DialToolsetListResponseDto> {
    const cacheKey = `toolsets:list:${userSub}`;
    const cached =
      await this.cacheManager.get<DialToolsetListResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for toolsets list (sub: ${userSub})`);
      return cached;
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
        data: (toolsets ?? []).map(redactToolsetSecrets),
      };
      await this.cacheManager.set(cacheKey, data, 30 * 1000);
      return data;
    } catch (err) {
      return handleDialFetchError(err, 'list toolsets', this.logger, 0);
    }
  }

  async getToolset(
    userSub: string,
    accessToken: string,
    toolsetName: string,
  ): Promise<DialToolsetDto> {
    const cacheKey = `toolsets:single:${userSub}:${toolsetName}`;
    const cached = await this.cacheManager.get<DialToolsetDto>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Cache hit for toolset "${toolsetName}" (sub: ${userSub})`,
      );
      return cached;
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
      return data;
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

  async createToolset(
    userSub: string,
    accessToken: string,
    body: ToolsetBodyDto,
  ): Promise<MutatedToolsetDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);

    try {
      const bucketResponse = await fetch(`${this.baseUrl}/v1/bucket`, {
        headers: authHeaders,
      });
      if (!bucketResponse.ok) {
        return mapDialHttpStatus(
          bucketResponse.status,
          'get user bucket',
          this.logger,
        );
      }
      const { bucket } = (await bucketResponse.json()) as { bucket: string };

      const version = body.version ?? DEFAULT_TOOLSET_VERSION;
      const encodedPath = encodeURIComponent(`${body.name}__${version}`);
      const id = `toolsets/${bucket}/${encodedPath}`;

      const response = await fetch(`${this.baseUrl}/v1/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(toDialToolsetBody(body, version)),
      });
      if (!response.ok) {
        return mapDialHttpStatus(
          response.status,
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
      const response = await fetch(`${this.baseUrl}/v1/${toolsetName}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(toDialToolsetBody(body, version)),
      });
      if (!response.ok) {
        return mapDialHttpStatus(
          response.status,
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
      const response = await fetch(`${this.baseUrl}/v1/${toolsetName}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) {
        return mapDialHttpStatus(
          response.status,
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
    const dialBody: Record<string, unknown> = {
      url: body.url,
      credentialsLevel: body.credentialsLevel,
      authenticationType: body.authenticationType,
    };
    if (body.authenticationType === ToolsetAuthType.ApiKey) {
      dialBody.apiKey = body.apiKey;
    } else if (body.authenticationType === ToolsetAuthType.OAuth) {
      dialBody.code = body.code;
      dialBody.redirectUri = body.redirectUri;
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/ops/toolset/signin`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(dialBody),
      });
      if (!response.ok) {
        return mapDialHttpStatus(
          response.status,
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
      const response = await fetch(`${this.baseUrl}/v1/ops/toolset/signout`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: body.url,
          credentialsLevel: body.credentialsLevel,
          authenticationType: body.authenticationType,
        }),
      });
      if (!response.ok) {
        return mapDialHttpStatus(
          response.status,
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
