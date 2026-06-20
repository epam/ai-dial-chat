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
  DialModelDto,
  DialModelListResponseDto,
} from '../openapi/openapi-response.dto';

@Injectable()
export class ModelsService extends AppService {
  protected override logger = new Logger(ModelsService.name);

  constructor(
    configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    super(configService);
  }

  async listModels(
    userSub: string,
    accessToken: string,
  ): Promise<DialModelListResponseDto> {
    const cacheKey = `models:list:${userSub}`;
    const cached =
      await this.cacheManager.get<DialModelListResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for models list (sub: ${userSub})`);
      return cached;
    }

    try {
      const result = await this.client.getModels({
        headers: getBearerAuthHeaders(accessToken),
      });
      if (result.error) {
        return mapDialHttpStatus(
          result.response.status,
          'list models',
          this.logger,
        );
      }
      const { data: models } =
        result.data as unknown as DialModelListResponseDto;
      const data: DialModelListResponseDto = { data: models };
      await this.cacheManager.set(cacheKey, data, 30 * 1000);
      return data;
    } catch (err) {
      return handleDialFetchError(err, 'list models', this.logger, 0);
    }
  }

  async getModel(
    userSub: string,
    accessToken: string,
    modelName: string,
  ): Promise<DialModelDto> {
    const cacheKey = `models:single:${userSub}:${modelName}`;
    const cached = await this.cacheManager.get<DialModelDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for model "${modelName}" (sub: ${userSub})`);
      return cached;
    }

    try {
      const result = await this.client.getModel(modelName, {
        headers: getBearerAuthHeaders(accessToken),
      });
      if (result.error) {
        return mapDialHttpStatus(
          result.response.status,
          `get model "${modelName}"`,
          this.logger,
        );
      }
      const data = result.data as unknown as DialModelDto;
      await this.cacheManager.set(cacheKey, data, 60 * 1000);
      return data;
    } catch (err) {
      return handleDialFetchError(
        err,
        `get model "${modelName}"`,
        this.logger,
        0,
      );
    }
  }
}
