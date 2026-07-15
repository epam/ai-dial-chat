import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { AppConfigEvalContext } from './app-config.types';
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

    const clientDefinitions = CONFIG_DEFINITIONS.filter(
      (d) => d.visibility === 'client',
    );

    const features: Record<string, boolean> = {};
    let asrModelId: string | null = null;
    let transcribeSizeLimitBytes = 5 * 1024 * 1024;
    let defaultDeploymentId: string | null = null;
    let dialCoreExternalUrl: string | null = null;

    for (const def of clientDefinitions) {
      const value = await this.compositeProvider.resolve(def.key, context);
      const resolved = value ?? def.defaultValue;

      if (def.type === 'feature') {
        // Strip the 'features.' prefix to get the short feature key name
        const shortKey = def.key.startsWith('features.')
          ? def.key.slice('features.'.length)
          : def.key;
        features[shortKey] = resolved === true;
      } else if (def.key === 'asr.modelId') {
        asrModelId = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'asr.transcribeSizeLimitBytes') {
        transcribeSizeLimitBytes =
          typeof resolved === 'number' ? resolved : 5 * 1024 * 1024;
      } else if (def.key === 'deployments.defaultDeploymentId') {
        defaultDeploymentId = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'dialCore.externalUrl') {
        dialCoreExternalUrl = typeof resolved === 'string' ? resolved : null;
      }
    }

    const response: ClientConfigResponseDto = {
      appId: context.appId,
      features,
      config: {
        asrModelId,
        transcribeSizeLimitBytes,
        defaultDeploymentId,
        dialCoreExternalUrl,
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
