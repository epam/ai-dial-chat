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

@Injectable()
export class DeploymentsService extends AppService {
  protected logger = new Logger(DeploymentsService.name);

  constructor(
    configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    super(configService);
  }

  async getDeployments(accessToken: string) {
    try {
      const result = await this.client.getDeployments({
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (result.error) {
        return mapDialHttpStatus(
          result.response.status,
          'get deployments',
          this.logger,
        );
      }
      return result.data;
    } catch (err) {
      return handleDialFetchError(err, 'get deployments', this.logger, 0);
    }
  }

  async getDeployment(name: string, accessToken: string) {
    try {
      const result = await this.client.getDeployment(name, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (result.error) {
        return mapDialHttpStatus(
          result.response.status,
          `get deployment "${name}"`,
          this.logger,
        );
      }
      return result.data;
    } catch (err) {
      return handleDialFetchError(
        err,
        `get deployment "${name}"`,
        this.logger,
        0,
      );
    }
  }

  async getDeploymentConfiguration(
    name: string,
    userSub: string,
    accessToken: string,
  ): Promise<Record<string, unknown>> {
    const cacheKey = `deployments:configuration:${userSub}:${name}`;
    const cached =
      await this.cacheManager.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Cache hit for deployment configuration "${name}" (sub: ${userSub})`,
      );
      return cached;
    }

    try {
      const result = await this.client.configurationDeployment(name, {
        headers: getBearerAuthHeaders(accessToken),
      });
      if (result.error) {
        return mapDialHttpStatus(
          result.response.status,
          `get deployment configuration "${name}"`,
          this.logger,
        );
      }
      const data = result.data as Record<string, unknown>;
      await this.cacheManager.set(cacheKey, data, 60 * 1000);
      return data;
    } catch (err) {
      return handleDialFetchError(
        err,
        `get deployment configuration "${name}"`,
        this.logger,
        0,
      );
    }
  }
}
