import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { resolveAppVersion } from '../common/utils/app-version';
import { EnvironmentVariables } from '../config/environment.config';
import type { AppConfigEvalContext } from './app-config.types';
import {
  applyClientConfigValue,
  createDefaultClientConfig,
} from './client-config.mapper';
import { CompositeConfigProvider } from './config-registry/composite-config.provider';
import { CONFIG_DEFINITIONS } from './config-registry/config-registry.constants';
import type { ClientConfigResponseDto } from './dto/client-config-response.dto';
import { FeatureKey } from './feature-flags/feature-key.enum';

const CACHE_TTL_SECONDS = 60;
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(
    private readonly compositeProvider: CompositeConfigProvider,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  async resolveValue(
    key: string,
    context: AppConfigEvalContext,
  ): Promise<unknown | undefined> {
    return this.compositeProvider.resolve(key, context);
  }

  async getClientConfig(
    context: AppConfigEvalContext,
  ): Promise<ClientConfigResponseDto> {
    const cacheKey = this.getClientConfigCacheKey(context);
    const cached =
      await this.cacheManager.get<ClientConfigResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    /* `app.version` is resolved ahead of the loop instead of inside it: both the
     * `appVersion` response field and the `%%VERSION%%` token inside
     * `footer.html` read it, and relying on CONFIG_DEFINITIONS ordering to have
     * it ready would be brittle. It is filtered out below so it is still
     * resolved exactly once per request. */
    const appVersion = await this.resolveConfiguredVersion(context);

    const clientDefinitions = CONFIG_DEFINITIONS.filter(
      (d) => d.visibility === 'client' && d.key !== 'app.version',
    );

    const warn = (message: string) => this.logger.warn(message);
    const features: Record<string, boolean> = {};
    const config = createDefaultClientConfig();

    for (const def of clientDefinitions) {
      const value = await this.compositeProvider.resolve(def.key, context);
      const resolved = value ?? def.defaultValue;

      if (def.type === 'feature') {
        // Strip the 'features.' prefix to get the short feature key name
        const shortKey = def.key.startsWith('features.')
          ? def.key.slice('features.'.length)
          : def.key;
        features[shortKey] = resolved === true;
      } else {
        applyClientConfigValue(config, def.key, {
          resolved,
          appVersion,
          warn,
        });
      }
    }

    const response: ClientConfigResponseDto = {
      appId: context.appId,
      features,
      config: {
        aiTextRefinementAvailable: Boolean(
          this.configService.get('UTILITY_MODEL', { infer: true })?.trim(),
        ),
        appVersion,
        ...config,
      },
      metadata: {
        resolvedAt: new Date().toISOString(),
        cacheTtlSeconds: CACHE_TTL_SECONDS,
      },
    };

    await this.cacheManager.set(cacheKey, response, CACHE_TTL_MS);
    return response;
  }

  async isEnabled(
    key: FeatureKey,
    context: AppConfigEvalContext,
  ): Promise<boolean> {
    const definition = CONFIG_DEFINITIONS.find((d) => d.key === key);
    if (!definition) {
      throw new BadRequestException(`Unknown feature key: "${key}"`);
    }
    if (definition.type !== 'feature') {
      throw new BadRequestException(
        `Key "${key}" is of type "${definition.type}", not "feature"`,
      );
    }

    try {
      const value = await this.compositeProvider.resolve(key, context);
      return value === true;
    } catch (err) {
      this.logger.error(
        `Failed to resolve feature key "${key}", failing closed: ${String(err)}`,
      );
      return false;
    }
  }

  /**
   * Resolves the version string shown to clients. The `app.version` key reads
   * `CHAT_VERSION`, so a CI/CD pipeline can stamp the deployed build; the
   * package.json fallback for a missing or blank value lives in
   * `resolveAppVersion`, shared with `GET /health`.
   */
  private async resolveConfiguredVersion(
    context: AppConfigEvalContext,
  ): Promise<string> {
    const resolved = await this.compositeProvider.resolve(
      'app.version',
      context,
    );
    return resolveAppVersion(typeof resolved === 'string' ? resolved : null);
  }

  private getClientConfigCacheKey(context: AppConfigEvalContext): string {
    const appId = encodeURIComponent(context.appId);
    const userId = encodeURIComponent(context.userId ?? 'anonymous');
    const roles =
      [...(context.roles ?? [])]
        .sort()
        .map((role) => encodeURIComponent(role))
        .join(',') || 'none';
    return `app-config:client:${appId}:user:${userId}:roles:${roles}`;
  }
}
