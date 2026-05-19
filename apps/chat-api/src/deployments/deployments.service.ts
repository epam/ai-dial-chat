import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from '../app/app.service';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/utils/dial-fetch-error';
import type { EnvironmentVariables } from '../config/environment.config';

@Injectable()
export class DeploymentsService extends AppService {
  protected logger = new Logger(DeploymentsService.name);

  constructor(configService: ConfigService<EnvironmentVariables>) {
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
}
