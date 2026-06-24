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
}
