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
import { resolveModelCatalogApiKey } from '../models/catalog/model-catalog-key';
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
import type {
  ClientAppConfigDto,
  ClientConfigManagedMetadataDto,
  ClientConfigResponseDto,
} from './dto/client-config-response.dto';
import {
  isCapabilityAvailable,
  readCapabilityInputs,
} from './feature-capabilities';
import { FeatureKey } from './feature-flags/feature-key.enum';
import { MANAGED_CONFIG_APP_ID } from './managed-config/managed-config.constants';
import {
  isManagedFeatureEnabled,
  nextManagedBoundary,
} from './managed-runtime/managed-evaluation';
import { ManagedRuntimeService } from './managed-runtime/managed-runtime.service';
import {
  isUsableManagedState,
  ManagedConfigMode,
  type ManagedResolutionView,
} from './managed-runtime/managed-runtime.types';

const CACHE_TTL_SECONDS = 60;
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;
/* The shortest TTL a managed boundary or staleness expiry can clip to. */
const MIN_CACHE_TTL_MS = 1000;

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
    private readonly managedRuntime: ManagedRuntimeService,
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
    return this.resolveSelected(key, this.withManagedView(context));
  }

  async getClientConfig(
    requestContext: AppConfigEvalContext,
  ): Promise<ClientConfigResponseDto> {
    /* Before the cache lookup, so an unserved identifier never gets an entry.
     * Outside managed `active` mode the response does not depend on which
     * served identifier asked. */
    if (!this.servedAppIds.has(requestContext.appId)) {
      throw new BadRequestException('Unknown appId');
    }
    /* Captured once, before the cache lookup: the cache key and every key of
     * the response depend on this one view. */
    const context = this.withManagedView(requestContext);
    const delivered = this.deliveredManagedView(context);
    const cacheKey = this.getClientConfigCacheKey(context, delivered);
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

    /* THEMES_CONFIG_URL is often an in-cluster address, so only the
     * explicitly public URL reaches the client. */
    const themesBaseUrl =
      this.configService
        .get('THEMES_PUBLIC_URL', { infer: true })
        ?.trim()
        .replace(/\/+$/, '') || undefined;

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
        modelCatalogAvailable:
          resolveModelCatalogApiKey(this.configService) != null,
        ...(themesBaseUrl != null ? { themesBaseUrl } : {}),
      },
      metadata: {
        resolvedAt: new Date().toISOString(),
        cacheTtlSeconds: CACHE_TTL_SECONDS,
      },
    };

    let ttlMs = CACHE_TTL_MS;
    if (delivered) {
      ttlMs = this.managedCacheTtlMs(delivered);
      const appConfig = this.foreignAppConfig(delivered);
      if (appConfig) response.appConfig = appConfig;
      response.metadata = {
        resolvedAt: new Date(delivered.now).toISOString(),
        cacheTtlSeconds: Math.ceil(ttlMs / 1000),
        nextRefreshAt: new Date(this.nextRefreshAt(delivered)).toISOString(),
        managed: this.managedMetadata(delivered),
      };
    }

    await this.cacheManager.set(cacheKey, response, ttlMs);
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
      const value = await this.resolveSelected(
        key,
        this.withManagedView(context),
      );
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
      this.applyManagedPolicy(key, selected, context),
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

  /**
   * Replaces any caller-supplied view with one captured now, so a single
   * evaluation reads one snapshot at one instant.
   */
  private withManagedView(context: AppConfigEvalContext): AppConfigEvalContext {
    return {
      ...context,
      managed: this.managedRuntime.captureView(context.appId),
    };
  }

  /**
   * The view whose metadata, refresh hint and cache identity a response
   * carries: only in `active` mode, and only for a mapped `appId`. Shadow
   * and `off` responses stay exactly as without managed configuration.
   */
  private deliveredManagedView(
    context: AppConfigEvalContext,
  ): (ManagedResolutionView & { instanceId: string }) | undefined {
    const view = context.managed;
    if (
      this.managedRuntime.mode !== ManagedConfigMode.Active ||
      view?.instanceId == null
    ) {
      return undefined;
    }
    return { ...view, instanceId: view.instanceId };
  }

  /**
   * The gates of an active managed feature (see `isManagedFeatureEnabled`).
   * Every other key, every key outside `active` mode, and every key of a
   * foreign application's response (its typed fields keep the `chat-ui`
   * environment values) keeps its selected value.
   */
  private applyManagedPolicy(
    key: string,
    selected: unknown,
    context: AppConfigEvalContext,
  ): unknown {
    if (
      context.managed?.appId !== MANAGED_CONFIG_APP_ID ||
      !this.managedRuntime.isActiveKey(key)
    ) {
      return selected;
    }
    const definition = CONFIG_DEFINITIONS.find((entry) => entry.key === key);
    if (definition?.type !== 'feature') return selected;
    return isManagedFeatureEnabled({
      key,
      view: context.managed,
      configuredEnabled: selected,
      capabilityAvailable: isCapabilityAvailable(
        key,
        readCapabilityInputs(this.configService),
      ),
      roles: context.roles,
    });
  }

  /* The active feature keys the captured snapshot can time-gate. */
  private nextBoundary(view: ManagedResolutionView): number | undefined {
    return view.snapshot && view.appId === MANAGED_CONFIG_APP_ID
      ? nextManagedBoundary(
          view.snapshot,
          this.managedRuntime.settings.activeKeys,
          view.now,
        )
      : undefined;
  }

  /*
   * At most 60 s, and never past the next window boundary or the moment the
   * snapshot becomes stale, so a cached response cannot outlive either.
   */
  private managedCacheTtlMs(view: ManagedResolutionView): number {
    const limits = [CACHE_TTL_MS];
    const boundary = this.nextBoundary(view);
    if (boundary != null) limits.push(boundary - view.now);
    if (view.snapshot && view.staleAt != null) {
      limits.push(view.staleAt - view.now);
    }
    return Math.max(MIN_CACHE_TTL_MS, Math.min(...limits));
  }

  private nextRefreshAt(view: ManagedResolutionView): number {
    const candidates = [
      view.now + this.managedRuntime.settings.clientRefreshMs,
    ];
    const boundary = this.nextBoundary(view);
    if (boundary != null) candidates.push(boundary);
    if (view.snapshot && view.staleAt != null) candidates.push(view.staleAt);
    return Math.min(...candidates);
  }

  private managedMetadata(
    view: ManagedResolutionView & { instanceId: string },
  ): ClientConfigManagedMetadataDto {
    const { snapshot } = view;
    if (!snapshot || !isUsableManagedState(view.state)) {
      return { instanceId: view.instanceId, state: view.state };
    }
    return {
      instanceId: view.instanceId,
      state: view.state,
      revisionId: snapshot.revisionId,
      schemaVersion: snapshot.schemaVersion,
      publishedAt: snapshot.publishedAt,
    };
  }

  /* A foreign application's payload, unchanged; never for `chat-ui`. */
  private foreignAppConfig(
    view: ManagedResolutionView,
  ): ClientAppConfigDto | undefined {
    const { snapshot } = view;
    if (view.appId === MANAGED_CONFIG_APP_ID || !snapshot) return undefined;
    return {
      schemaVersion: snapshot.schemaVersion,
      schemaSha256: snapshot.schemaSha256,
      revisionId: snapshot.revisionId,
      publishedAt: snapshot.publishedAt,
      payload: snapshot.payload as Record<string, unknown>,
    };
  }

  /**
   * The allowed-roles list of a feature, if it declares one. An unset roles
   * variable holds its typed default, an empty list, which means no
   * restriction.
   */
  private readAllowedRoles(key: string): readonly string[] | undefined {
    const rolesVariable = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === key,
    )?.allowedRolesEnvVar;
    return rolesVariable
      ? this.configService.get(rolesVariable, { infer: true })
      : undefined;
  }

  private getClientConfigCacheKey(
    context: AppConfigEvalContext,
    delivered: ManagedResolutionView | undefined,
  ): string {
    const appId = encodeURIComponent(context.appId);
    const userId = encodeURIComponent(context.userId ?? 'anonymous');
    const roles =
      [...(context.roles ?? [])]
        .sort()
        .map((role) => encodeURIComponent(role))
        .join(',') || 'none';
    const key = `app-config:client:${appId}:user:${userId}:roles:${roles}`;
    if (!delivered?.instanceId) return key;
    /* A new revision and every change of managed state use a new entry. */
    const instance = encodeURIComponent(delivered.instanceId);
    const revision = encodeURIComponent(
      delivered.snapshot?.revisionId ?? 'none',
    );
    return `${key}:managed:${instance}:${revision}:${delivered.state}`;
  }
}
