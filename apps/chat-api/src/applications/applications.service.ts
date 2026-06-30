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
import type { ApplicationsResponseDto } from './dto/application.dto';
import type {
  CreateApplicationBodyDto,
  CreatedApplicationDto,
} from './dto/create-application.dto';

@Injectable()
export class ApplicationsService extends AppService {
  protected override logger = new Logger(ApplicationsService.name);

  constructor(
    configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    super(configService);
  }

  async listApplications(
    userSub: string,
    accessToken: string,
  ): Promise<ApplicationsResponseDto> {
    const cacheKey = `applications:list:${userSub}`;
    const cached =
      await this.cacheManager.get<ApplicationsResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for applications list (sub: ${userSub})`);
      return cached;
    }

    try {
      const result = await this.client.getApplications({
        headers: getBearerAuthHeaders(accessToken),
      });
      if (result.error) {
        return mapDialHttpStatus(
          result.response.status,
          'list applications',
          this.logger,
        );
      }
      const data: ApplicationsResponseDto = {
        data:
          (result.data as { data?: ApplicationsResponseDto['data'] }).data ??
          [],
      };
      await this.cacheManager.set(cacheKey, data, 30 * 1000);
      return data;
    } catch (err) {
      return handleDialFetchError(err, 'list applications', this.logger, 0);
    }
  }

  async createApplication(
    userSub: string,
    accessToken: string,
    body: CreateApplicationBodyDto,
  ): Promise<CreatedApplicationDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    const cacheKey = `applications:list:${userSub}`;

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

      const version = body.version ?? '0.0.1';
      const appPath = `${body.name}__${version}`;
      const encodedPath = encodeURIComponent(appPath);

      const dialBody: Record<string, unknown> = {
        display_name: body.name,
        display_version: version,
        application_type_schema_id: body.type,
      };
      if (body.description != null) dialBody.description = body.description;
      if (body.iconUrl != null) dialBody.icon_url = body.iconUrl;
      if (body.topics != null && body.topics.length > 0)
        dialBody.topics = body.topics;

      const response = await fetch(
        `${this.baseUrl}/v1/applications/${bucket}/${encodedPath}`,
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
