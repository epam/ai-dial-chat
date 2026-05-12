// TODO: Re-enable when @epam/ai-dial-typescript-sdk is available
// import { createSDK } from '@epam/ai-dial-typescript-sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/environment.config';

/**
 * Base service for the chat application.
 *
 * Placeholder for AI DIAL SDK integration. The SDK client will be initialized
 * here when the @epam/ai-dial-typescript-sdk package becomes available.
 *
 * @remarks
 * The AI DIAL SDK client will be configured with the DIAL_CORE_URL and DIAL_API_KEY
 * environment variables, which are validated at application startup.
 *
 * @todo Install and configure @epam/ai-dial-typescript-sdk when available
 */
@Injectable()
export class AppService {
  /**
   * AI DIAL SDK client instance (placeholder).
   * Will be available for use by services that need to interact with the AI DIAL core service.
   *
   * @todo Uncomment when SDK is installed
   */
  // protected client: ReturnType<typeof createSDK>;

  constructor(private configService: ConfigService<EnvironmentVariables>) {
    // TODO: Initialize AI DIAL SDK client when package is available
    // this.client = createSDK({
    //   baseUrl: this.configService.get('DIAL_CORE_URL', { infer: true }),
    //   apiKey: this.configService.get('DIAL_API_KEY', { infer: true }),
    // });
  }
}
