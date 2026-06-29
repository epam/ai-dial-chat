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
}
