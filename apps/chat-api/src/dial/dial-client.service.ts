import { createSDK } from '@epam/ai-dial-typescript-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/environment.config';

@Injectable()
export class DialClientService {
  private readonly logger = new Logger(DialClientService.name);

  readonly client: ReturnType<typeof createSDK>;
  readonly baseUrl: string;
  readonly dialApiVersion: string;

  constructor(configService: ConfigService<EnvironmentVariables>) {
    const baseUrl = configService.get('DIAL_CORE_URL', { infer: true });
    if (!baseUrl) {
      throw new Error('DIAL_CORE_URL is not configured');
    }
    this.baseUrl = baseUrl;
    this.dialApiVersion =
      configService.get('DIAL_API_VERSION', { infer: true }) ?? '2024-10-21';

    this.logger.debug(
      `Initializing DIAL TypeScript SDK client with baseUrl=${this.baseUrl}`,
    );
    this.client = createSDK({ baseUrl: this.baseUrl });
    this.logger.debug('DIAL TypeScript SDK client initialized');
  }
}
