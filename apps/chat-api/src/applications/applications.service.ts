import type { components } from '@epam/ai-dial-typescript-sdk';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
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

type DialApplication = components['schemas']['Application'];

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
      const bucketResponse = await this.dialClient.client.getUserBucket({
        headers: authHeaders,
      });
      if (bucketResponse.error) {
        return mapDialHttpStatus(
          bucketResponse.response.status,
          'get user bucket',
          this.logger,
        );
      }
      const { bucket } = bucketResponse.data ?? {};
      if (bucket == null) {
        throw new BadGatewayException('DIAL Core returned an empty bucket');
      }

      const version = body.version ?? '0.0.1';
      const appPath = `${body.name}__${version}`;
      const encodedPath = encodeURIComponent(appPath);

      const dialBody: DialApplication = {
        displayName: body.name,
        displayVersion: version,
        application_type_schema_id: body.type,
        application_properties: body.applicationProperties ?? {},
      };
      if (body.description != null) dialBody.description = body.description;
      if (body.iconUrl != null) dialBody.iconUrl = body.iconUrl;
      if (body.topics != null && body.topics.length > 0)
        dialBody.descriptionKeywords = body.topics;

      const response = await this.dialClient.client.saveCustomApplication(
        bucket,
        encodedPath,
        {
          headers: authHeaders,
          body: dialBody,
        },
      );

      if (response.error) {
        return mapDialHttpStatus(
          response.response.status,
          'create application',
          this.logger,
        );
      }

      await this.cacheManager.del(cacheKey);
      this.logger.debug(
        `Created application ${appPath}, invalidated cache for sub: ${userSub}`,
      );
      return { id: `applications/${bucket}/${appPath}` };
    } catch (err) {
      return handleDialFetchError(err, 'create application', this.logger, 0);
    }
  }
}
