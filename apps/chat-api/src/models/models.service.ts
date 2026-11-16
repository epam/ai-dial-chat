import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { mapDialHttpStatus } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import type { EnvironmentVariables } from '../config/environment.config';
import {
  hasHiddenEntityTag,
  readHiddenEntityTags,
} from '../deployments/utils/hidden-entity-tags.util';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import type {
  DialModelDto,
  DialModelListResponseDto,
} from '../openapi/openapi-response.dto';

/**
 * Proxies DIAL Core's user-scoped model list and lookup. Models tagged with
 * `HIDDEN_ENTITY_TAGS` are left out, as in the Chat Catalog, so every
 * frontend built on these routes hides the same models. Hiding is not access
 * control: Core still decides what the user may call.
 */
@Injectable()
export class ModelsService {
  private readonly logger = new Logger(ModelsService.name);
  private readonly hiddenTags: ReadonlySet<string>;

  constructor(
    private readonly dialClient: DialClientService,
    configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.hiddenTags = readHiddenEntityTags(configService);
  }

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
        if (!result.response.ok || result.error != null) {
          return mapDialHttpStatus(
            result.response.status,
            'list models',
            this.logger,
          );
        }
        const { data: models } =
          result.data as unknown as DialModelListResponseDto;
        /* Filtered before caching: the tags are fixed at boot, so the cached
         * entry never needs re-filtering. */
        return {
          data: models.filter(
            (model) =>
              !hasHiddenEntityTag(model.description_keywords, this.hiddenTags),
          ),
        };
      },
    });
  }

  async getModel(
    userSub: string,
    accessToken: string,
    modelName: string,
  ): Promise<DialModelDto> {
    const model = await this.fetchModel(userSub, accessToken, modelName);
    /* Checked after the cache rather than inside `fetch`: a thrown `fetch` is
     * never cached, so every lookup of a hidden model would call Core again.
     * The message matches a Core 404, so a hidden model looks like a missing
     * one. */
    if (hasHiddenEntityTag(model.description_keywords, this.hiddenTags)) {
      throw new NotFoundException('Resource not found');
    }
    return model;
  }

  private fetchModel(
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
        if (!result.response.ok || result.error != null) {
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
