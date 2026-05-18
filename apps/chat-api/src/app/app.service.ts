import { createSDK } from '@epam/ai-dial-typescript-sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/environment.config';

@Injectable()
export class AppService {
  protected client: ReturnType<typeof createSDK>;
  protected configService: ConfigService<EnvironmentVariables>;

  constructor(configService: ConfigService<EnvironmentVariables>) {
    this.configService = configService;
    this.client = createSDK({
      baseUrl: configService.get('DIAL_CORE_URL', { infer: true }) as string,
      apiKey: configService.get('DIAL_API_KEY', { infer: true }),
    });
  }
}
