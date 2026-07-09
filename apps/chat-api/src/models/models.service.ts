import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { mapDialHttpStatus } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import type {
  DialModelDto,
  DialModelListResponseDto,
} from '../openapi/openapi-response.dto';

@Injectable()
export class ModelsService {
  private readonly logger = new Logger(ModelsService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async listModels(
    userSub: string,
    accessToken: string,
  ): Promise<DialModelListResponseDto> {
    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: `models:list:${userSub}`,
      ttlMs: 30 * 1000,
      context: 'list models',
      logger: this.logger,
      fetch: async () => {
        const result = await this.dialClient.client.getModels({
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
        return { data: models };
      },
    });
  }

  async getModel(
    userSub: string,
    accessToken: string,
    modelName: string,
  ): Promise<DialModelDto> {
    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: `models:single:${userSub}:${modelName}`,
      ttlMs: 60 * 1000,
      context: `get model "${modelName}"`,
      logger: this.logger,
      fetch: async () => {
        const result = await this.dialClient.client.getModel(modelName, {
          headers: getBearerAuthHeaders(accessToken),
        });
        if (result.error) {
          return mapDialHttpStatus(
            result.response.status,
            `get model "${modelName}"`,
            this.logger,
          );
        }
        return result.data as unknown as DialModelDto;
      },
    });
  }
}
