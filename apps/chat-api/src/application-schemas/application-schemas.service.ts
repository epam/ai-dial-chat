import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { AppService } from '../app/app.service';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import type { EnvironmentVariables } from '../config/environment.config';
import type {
  ApplicationSchemasResponseDto,
  ApplicationSchemaSummaryDto,
} from './dto/application-schema.dto';

@Injectable()
export class ApplicationSchemasService extends AppService {
  protected override readonly logger = new Logger(
    ApplicationSchemasService.name,
  );

  constructor(
    configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    super(configService);
  }

  async listApplicationSchemas(
    userSub: string,
    accessToken: string,
  ): Promise<ApplicationSchemasResponseDto> {
    const cacheKey = `application-schemas:list:${userSub}`;
    const cached =
      await this.cacheManager.get<ApplicationSchemasResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Cache hit for application schemas list (sub: ${userSub})`,
      );
      return cached;
    }

    try {
      const result = await this.client.listCustomApplicationSchemas({
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
      const data: ApplicationSchemasResponseDto = {
        schemas: items.map((rawItem): ApplicationSchemaSummaryDto => {
          const id = rawItem['$id'] as string | undefined;
          const isQuickApp = id?.includes('quickapps2') ?? false;
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
      await this.cacheManager.set(cacheKey, data, 60 * 1000);
      return data;
    } catch (err) {
      return handleDialFetchError(
        err,
        'list application schemas',
        this.logger,
        0,
      );
    }
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
      const result = await this.client.getCustomApplicationSchema({
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
