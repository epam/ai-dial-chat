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
import { DEFAULT_CLIENT_CONFIG_APP_IDS } from '../config/env/client-ui.env';
import { EnvironmentVariables } from '../config/environment.config';
import { ExplicitEnvironment } from '../config/explicit-environment';
import type { AppConfigEvalContext } from './app-config.types';
import {
  evaluateCatalogCreationPolicy,
  normalizeCatalogCreationPolicy,
  type CatalogCreationPolicy,
} from './catalog-creation-policy';
import {
  applyClientConfigValue,
  createDefaultClientConfig,
} from './client-config.mapper';
import { CompositeConfigProvider } from './config-registry/composite-config.provider';
import { CONFIG_DEFINITIONS } from './config-registry/config-registry.constants';
import { applyDeploymentRoleGate } from './deployment-role-gate';
import type { ClientConfigResponseDto } from './dto/client-config-response.dto';
import { FeatureKey } from './feature-flags/feature-key.enum';

const CACHE_TTL_SECONDS = 60;
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);
  /* Normalized once, so an empty-rule warning is logged at startup only. */
  private readonly catalogCreationPolicy: CatalogCreationPolicy;
  /* The `appId` values `getClientConfig` serves (`CLIENT_CONFIG_APP_IDS`). */
  private readonly servedAppIds: ReadonlySet<string>;

  constructor(
    private readonly compositeProvider: CompositeConfigProvider,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService<EnvironmentVariables>,
    private readonly explicitEnvironment: ExplicitEnvironment,
  ) {
    this.catalogCreationPolicy = normalizeCatalogCreationPolicy(
      this.configService.get('CATALOG_CREATION_ROLES', { infer: true }),
      (message) => this.logger.warn(message),
    );
    const servedAppIds = this.configService.get('CLIENT_CONFIG_APP_IDS', {
      infer: true,
    });
    this.servedAppIds = new Set(
      servedAppIds?.length ? servedAppIds : DEFAULT_CLIENT_CONFIG_APP_IDS,
    );
  }

  async resolveValue(
    key: string,
    context: AppConfigEvalContext,
  ): Promise<unknown | undefined> {
    return this.resolveSelected(key, context);
  }

  async getClientConfig(
    context: AppConfigEvalContext,
  ): Promise<ClientConfigResponseDto> {
    /* Before the cache lookup, so an unserved identifier never gets an entry.
     * The response itself does not depend on which served identifier asked. */
    if (!this.servedAppIds.has(context.appId)) {
      throw new BadRequestException('Unknown appId');
    }
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
      const value = await this.resolveSelected(def.key, context);
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

    const catalogCreationPermissions = evaluateCatalogCreationPolicy(
      this.catalogCreationPolicy,
      context.roles,
    );

    const response: ClientConfigResponseDto = {
      appId: context.appId,
      features,
      config: {
        aiTextRefinementAvailable: Boolean(
          this.configService.get('UTILITY_MODEL', { infer: true })?.trim(),
        ),
        appVersion,
        ...config,
        catalogCreationPermissions,
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
      const value = await this.resolveSelected(key, context);
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
   * workspace-root package.json fallback for a missing or blank value lives in
   * `resolveAppVersion`, shared with `GET /health`.
   */
  private async resolveConfiguredVersion(
    context: AppConfigEvalContext,
  ): Promise<string> {
    const resolved = await this.resolveSelected('app.version', context);
    return resolveAppVersion(typeof resolved === 'string' ? resolved : null);
  }

  /**
   * Selects a value through the provider chain, then applies the policy that
   * holds for every source: the feature's deployment role gate. Every
   * resolution path of this service goes through here.
   */
  private async resolveSelected(
    key: string,
    context: AppConfigEvalContext,
  ): Promise<unknown | undefined> {
    const selected = await this.compositeProvider.resolve(key, context);
    const allowedRoles = this.readAllowedRoles(key);
    const gated = applyDeploymentRoleGate(
      selected,
      allowedRoles,
      context.roles,
    );
    if (gated !== selected) {
      this.logger.debug(
        `Key "${key}" restricted: user roles [${(context.roles ?? []).join(', ')}] not in allowed [${(allowedRoles ?? []).join(', ')}]`,
      );
    }
    return gated;
  }

  /** The explicitly configured allowed-roles list of a feature, if any. */
  private readAllowedRoles(key: string): readonly string[] | undefined {
    const rolesVariable = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === key,
    )?.allowedRolesEnvVar;
    if (!rolesVariable || !this.explicitEnvironment.isExplicit(rolesVariable)) {
      return undefined;
    }
    const roles: unknown = this.configService.get(rolesVariable, {
      infer: true,
    });
    return Array.isArray(roles) &&
      roles.every((role) => typeof role === 'string')
      ? roles
      : undefined;
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
