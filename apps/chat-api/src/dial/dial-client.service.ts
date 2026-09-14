import { createSDK } from '@epam/ai-dial-typescript-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveAppVersion } from '../common/utils/app-version';
import { StringUtils } from '../common/utils/string-utils';
import { EnvironmentVariables } from '../config/environment.config';

const USER_AGENT_PRODUCT = 'ai-dial-chat';
const UNSUPPORTED_USER_AGENT_VERSION_CHARACTERS = /[^A-Za-z0-9._-]+/g;

const normalizeUserAgentVersion = (version: string): string => {
  /*
   * Hyphens are allowed characters, so a version may legitimately carry a run
   * of them at either end — they are trimmed by index scan rather than a
   * `/^-+|-+$/` regex, whose `-+$` alternative has an unanchored start and so
   * costs quadratic time on a mostly-hyphen version (CodeQL
   * js/polynomial-redos).
   */
  const normalized = StringUtils.stripSurroundingChar(
    version.replace(UNSUPPORTED_USER_AGENT_VERSION_CHARACTERS, '-'),
    '-',
  );

  return normalized || 'unknown';
};

@Injectable()
export class DialClientService {
  private readonly logger = new Logger(DialClientService.name);

  readonly client: ReturnType<typeof createSDK>;
  readonly baseUrl: string;
  readonly dialApiVersion: string;
  readonly userAgent: string;
  readonly fetchCore: typeof fetch;

  constructor(configService: ConfigService<EnvironmentVariables>) {
    const baseUrl = configService.get('DIAL_CORE_URL', { infer: true });
    if (!baseUrl) {
      throw new Error('DIAL_CORE_URL is not configured');
    }
    this.baseUrl = baseUrl;
    this.dialApiVersion =
      configService.get('DIAL_API_VERSION', { infer: true }) ?? '2024-10-21';
    const appVersion = resolveAppVersion(
      configService.get('CHAT_VERSION', { infer: true }),
    );
    this.userAgent = `${USER_AGENT_PRODUCT}/${normalizeUserAgentVersion(appVersion)}`;
    this.fetchCore = (input, init) => {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      headers.set('User-Agent', this.userAgent);

      return globalThis.fetch(input, { ...init, headers });
    };

    this.logger.debug(
      `Initializing DIAL TypeScript SDK client with baseUrl=${this.baseUrl}`,
    );
    this.client = createSDK({ baseUrl: this.baseUrl, fetch: this.fetchCore });
    this.logger.debug('DIAL TypeScript SDK client initialized');
  }
}
