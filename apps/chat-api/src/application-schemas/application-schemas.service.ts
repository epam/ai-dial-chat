import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { mapDialHttpStatus } from '../common/dial/dial-error.mapper';
import { isQuickAppSchema } from '../common/utils/application-schema';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import type { EnvironmentVariables } from '../config/environment.config';
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
    private readonly configService: ConfigService<EnvironmentVariables>,
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
        const devQuickAppsEditorUrl = this.configService.get(
          'DEV_QUICKAPPS_EDITOR_URL',
          { infer: true },
        );
        return {
          schemas: items.map((rawItem): ApplicationSchemaSummaryDto => {
            const id = rawItem['$id'] as string | undefined;
            const isQuickApp = isQuickAppSchema(id);
            return {
              id,
              displayName: rawItem['dial:applicationTypeDisplayName'],
              viewerUrl: rawItem['dial:applicationTypeViewerUrl'],
              editorUrl:
                isQuickApp && devQuickAppsEditorUrl
                  ? devQuickAppsEditorUrl
                  : rawItem['dial:applicationTypeEditorUrl'],
              schemaEndpoint: rawItem['dial:applicationTypeSchemaEndpoint'],
              iconUrl: rawItem['dial:applicationTypeIconUrl'],
            };
          }),
        };
      },
    });
  }

  async getApplicationSchema(
    userSub: string,
    accessToken: string,
    schemaId: string,
  ): Promise<Record<string, unknown>> {
    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: `application-schemas:item:${userSub}:${schemaId}`,
      ttlMs: 60 * 1000,
      context: 'get application schema',
      logger: this.logger,
      fetch: async () => {
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
        return result.data as Record<string, unknown>;
      },
    });
  }
}
