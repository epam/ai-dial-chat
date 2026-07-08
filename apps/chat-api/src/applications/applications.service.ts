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
import type { ApplicationsResponseDto } from './dto/application.dto';
import type {
  CreateApplicationBodyDto,
  CreatedApplicationDto,
} from './dto/create-application.dto';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async listApplications(
    userSub: string,
    accessToken: string,
  ): Promise<ApplicationsResponseDto> {
    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: `applications:list:${userSub}`,
      ttlMs: 30 * 1000,
      context: 'list applications',
      logger: this.logger,
      fetch: async () => {
        const result = await this.dialClient.client.getApplications({
          headers: getBearerAuthHeaders(accessToken),
        });
        if (result.error) {
          return mapDialHttpStatus(
            result.response.status,
            'list applications',
            this.logger,
          );
        }
        return {
          data:
            (result.data as { data?: ApplicationsResponseDto['data'] }).data ??
            [],
        };
      },
    });
  }

  async createApplication(
    userSub: string,
    accessToken: string,
    body: CreateApplicationBodyDto,
  ): Promise<CreatedApplicationDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    const cacheKey = `applications:list:${userSub}`;

    try {
      const bucketResponse = await fetch(
        `${this.dialClient.baseUrl}/v1/bucket`,
        {
          headers: authHeaders,
        },
      );
      if (!bucketResponse.ok) {
        return mapDialHttpStatus(
          bucketResponse.status,
          'get user bucket',
          this.logger,
        );
      }
      const { bucket } = (await bucketResponse.json()) as { bucket: string };

      const version = body.version ?? '0.0.1';
      const appPath = `${body.name}__${version}`;
      const encodedPath = encodeURIComponent(appPath);

      const dialBody: Record<string, unknown> = {
        display_name: body.name,
        display_version: version,
        application_type_schema_id: body.type,
        application_properties: {},
      };
      if (body.description != null) dialBody.description = body.description;
      if (body.iconUrl != null) dialBody.icon_url = body.iconUrl;
      if (body.topics != null && body.topics.length > 0)
        dialBody.description_keywords = body.topics;

      const response = await fetch(
        `${this.dialClient.baseUrl}/v1/applications/${bucket}/${encodedPath}`,
        {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(dialBody),
        },
      );

      if (!response.ok) {
        return mapDialHttpStatus(
          response.status,
          'create application',
          this.logger,
        );
      }

      await this.cacheManager.del(cacheKey);
      this.logger.debug(
        `Created application ${appPath}, invalidated cache for sub: ${userSub}`,
      );
      return { id: `applications/${bucket}/${encodedPath}` };
    } catch (err) {
      return handleDialFetchError(err, 'create application', this.logger, 0);
    }
  }
}
