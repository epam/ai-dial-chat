import { createSDK } from '@epam/ai-dial-typescript-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildChatUserAgent } from '../common/utils/user-agent';
import { EnvironmentVariables } from '../config/environment.config';
import { withCoreRequestTiming } from '../telemetry/upstream-request-timing';
import { streamingFetch } from './streaming-fetch';

@Injectable()
export class DialClientService {
  private readonly logger = new Logger(DialClientService.name);

  readonly client: ReturnType<typeof createSDK>;
  readonly baseUrl: string;
  readonly dialApiVersion: string;
  readonly userAgent: string;
  readonly fetchCore: typeof fetch;
  /**
   * `fetchCore` for large streamed request bodies (file uploads). Same
   * User-Agent and Core timing, but sent through `streamingFetch`, which
   * honours socket backpressure — native `fetch` buffers the whole body.
   */
  readonly uploadCore: typeof fetch;

  constructor(configService: ConfigService<EnvironmentVariables>) {
    const baseUrl = configService.get('DIAL_CORE_URL', { infer: true });
    if (!baseUrl) {
      throw new Error('DIAL_CORE_URL is not configured');
    }
    this.baseUrl = baseUrl;
    this.dialApiVersion =
      configService.get('DIAL_API_VERSION', { infer: true }) ?? '2024-10-21';
    this.userAgent = buildChatUserAgent(
      configService.get('CHAT_VERSION', { infer: true }),
    );
    this.fetchCore = this.withCoreHeaders((input, init) =>
      globalThis.fetch(input, init),
    );
    this.uploadCore = this.withCoreHeaders(streamingFetch);

    this.logger.debug(
      `Initializing DIAL TypeScript SDK client with baseUrl=${this.baseUrl}`,
    );
    this.client = createSDK({ baseUrl: this.baseUrl, fetch: this.fetchCore });
    this.logger.debug('DIAL TypeScript SDK client initialized');
  }

  private withCoreHeaders(transport: typeof fetch): typeof fetch {
    return (input, init) => {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      headers.set('User-Agent', this.userAgent);

      return withCoreRequestTiming(() =>
        transport(input, { ...init, headers }),
      );
    };
  }
}
