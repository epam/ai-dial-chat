import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import type {
  ApplicationSchemasResponseDto,
  ApplicationSchemaSummaryDto,
} from './dto/application-schema.dto';

@Injectable()
export class ApplicationSchemasService {
  private readonly logger = new Logger(ApplicationSchemasService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async listApplicationSchemas(
    userSub: string,
    accessToken: string,
  ): Promise<ApplicationSchemasResponseDto> {
    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: `application-schemas:list:${userSub}`,
      ttlMs: 60 * 1000,
      context: 'list application schemas',
      logger: this.logger,
      fetch: async () => {
        const result =
          await this.dialClient.client.listCustomApplicationSchemas({
            headers: getBearerAuthHeaders(accessToken),
          });
        if (result.error) {
          return mapDialHttpStatus(
            result.response.status,
            'list application schemas',
            this.logger,
          );
        }
        const items = Array.isArray(result.data) ? result.data : [];
        return {
          schemas: items.map(
            (rawItem): ApplicationSchemaSummaryDto => ({
              id: rawItem['$id'],
              displayName: rawItem['dial:applicationTypeDisplayName'],
              viewerUrl: rawItem['dial:applicationTypeViewerUrl'],
              editorUrl: rawItem['dial:applicationTypeEditorUrl'],
              schemaEndpoint: rawItem['dial:applicationTypeSchemaEndpoint'],
              iconUrl: rawItem['dial:applicationTypeIconUrl'],
            }),
          ),
        };
      },
    });
  }

  async getApplicationSchema(
    userSub: string,
    accessToken: string,
    schemaId: string,
  ): Promise<Record<string, unknown>> {
    const cacheKey = `application-schemas:item:${userSub}:${schemaId}`;
    const cached =
      await this.cacheManager.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Cache hit for application schema (sub: ${userSub}, id: ${schemaId})`,
      );
      return cached;
    }

    try {
      const result = await this.dialClient.client.getCustomApplicationSchema({
        params: { query: { id: schemaId } },
        headers: getBearerAuthHeaders(accessToken),
      });
      if (result.error) {
        return mapDialHttpStatus(
          result.response.status,
          'get application schema',
          this.logger,
        );
      }
      const schema = result.data as Record<string, unknown>;
      await this.cacheManager.set(cacheKey, schema, 60 * 1000);
      return schema;
    } catch (err) {
      return handleDialFetchError(
        err,
        'get application schema',
        this.logger,
        0,
      );
    }
  }
}
