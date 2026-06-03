import { createSDK } from '@epam/ai-dial-typescript-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/environment.config';

@Injectable()
export class AppService {
  protected client: ReturnType<typeof createSDK>;
  protected configService: ConfigService<EnvironmentVariables>;
  protected baseUrl: string;
  protected dialApiVersion: string;
  protected logger = new Logger(AppService.name);

  constructor(configService: ConfigService<EnvironmentVariables>) {
    this.configService = configService;
    this.baseUrl = configService.get('DIAL_CORE_URL', {
      infer: true,
    }) as string;
    this.dialApiVersion =
      configService.get('DIAL_API_VERSION', { infer: true }) ?? '2024-10-21';

    this.logger.debug(
      `Initializing DIAL TypeScript SDK client with baseUrl=${this.baseUrl}`,
    );
    this.client = createSDK({ baseUrl: this.baseUrl });
    this.logger.debug('DIAL TypeScript SDK client initialized');
  }
}
